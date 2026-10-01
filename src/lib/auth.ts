import { db } from "@/lib/db";
import { jwtVerify, SignJWT } from "jose";

export interface AuthUser {
  id: string;
  role: string;
  tenantId: string | null;
}

let cachedSecret: Uint8Array | null = null;

// In production a real secret is mandatory. The dev fallback exists only so
// local development without .env keeps working — it is never used in production.
export function getJwtSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "JWT_SECRET is missing or too short (min 32 chars). Refusing to sign/verify tokens in production."
      );
    }
    if (!raw) {
      console.warn("[auth] JWT_SECRET not set — using INSECURE development secret. Do NOT use in production.");
    } else {
      console.warn("[auth] JWT_SECRET is shorter than 32 chars — insecure. Do NOT use in production.");
    }
    cachedSecret = new TextEncoder().encode("insecure-dev-only-secret-change-me-0123456789");
    return cachedSecret;
  }
  cachedSecret = new TextEncoder().encode(raw);
  return cachedSecret;
}

export async function signAuthToken(user: {
  id: string;
  role: string;
  tenantId: string | null;
  tokenVersion: number;
}): Promise<string> {
  return new SignJWT({
    sub: user.id,
    role: user.role,
    tenantId: user.tenantId,
    tv: user.tokenVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function unauthorized(error = "لطفاً ابتدا وارد حساب خود شوید"): Response {
  return jsonError(401, error);
}

export function forbidden(error = "دسترسی غیرمجاز — این عملیات نیاز به دسترسی خاص دارد"): Response {
  return jsonError(403, error);
}

// Verify JWT from the request cookie and re-check the user against the DB.
export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, v.join("=")];
      })
    );
    const token = cookies["token"];
    if (!token) return null;

    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub || !payload.role) return null;

    // Verify the user still exists in DB, role/token version unchanged
    const user = await db.user.findUnique({
      where: { id: payload.sub as string },
      select: { id: true, role: true, tenantId: true, tokenVersion: true },
    });
    if (!user || user.role !== payload.role) return null;
    if ((payload.tv ?? 0) !== user.tokenVersion) return null;

    return { id: user.id, role: user.role, tenantId: user.tenantId };
  } catch {
    return null;
  }
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

// Require authentication (any role). Returns the user or a 401 Response.
export async function requireAuth(req: Request): Promise<AuthUser | Response> {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  return user;
}

// Require one of the given roles. Returns the user or a 401/403 Response.
export async function requireRole(req: Request, roles: string[]): Promise<AuthUser | Response> {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (!roles.includes(user.role)) return forbidden();
  return user;
}

export interface TenantAuth {
  user: AuthUser;
  tenantId: string;
}

export const TENANT_ROLES = ["business_owner", "operator"];
export const OWNER_ROLES = ["business_owner", "super_admin"];

interface RequireTenantOptions {
  // Extra allowlist on top of the default tenant roles (super_admin is always allowed)
  roles?: string[];
  // Bypass the tenant-status gate (used by admin/platform-level reads)
  allowSuspended?: boolean;
}

// Resolve the tenant a request is allowed to act on and verify access:
// - super_admin may target any tenant (tenantId must be provided)
// - business_owner/operator may only target their own tenant
// - suspended tenants are blocked for normal member operations
export async function requireTenant(
  req: Request,
  requestedTenantId?: string | null,
  opts: RequireTenantOptions = {}
): Promise<TenantAuth | Response> {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const allowed = opts.roles ?? TENANT_ROLES;
  if (user.role !== "super_admin" && !allowed.includes(user.role)) return forbidden();

  let tenantId: string;
  if (user.role === "super_admin") {
    if (!requestedTenantId) return jsonError(400, "tenantId required");
    tenantId = requestedTenantId;
  } else {
    if (!user.tenantId) return forbidden();
    if (requestedTenantId && requestedTenantId !== user.tenantId) return forbidden();
    tenantId = user.tenantId;
  }

  if (!opts.allowSuspended) {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });
    if (!tenant) return jsonError(404, "کسب‌وکار یافت نشد");
    if (tenant.status === "suspended") {
      return forbidden("این کسب‌وکار موقتاً غیرفعال شده است");
    }
  }

  return { user, tenantId };
}

// Require an owner-level tenant actor (business_owner or super_admin).
export async function requireTenantOwner(
  req: Request,
  requestedTenantId?: string | null
): Promise<TenantAuth | Response> {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (!OWNER_ROLES.includes(user.role)) return forbidden();
  return requireTenant(req, requestedTenantId, { roles: OWNER_ROLES });
}

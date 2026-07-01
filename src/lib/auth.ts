import { db } from "@/lib/db";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-dev-secret-change-in-production");

export interface AuthUser {
  id: string;
  role: string;
  tenantId: string | null;
}

// Verify JWT from the request cookie.
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

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.sub || !payload.role) return null;

    // Verify the user still exists in DB (prevents deleted users from using old tokens)
    const user = await db.user.findUnique({
      where: { id: payload.sub as string },
      select: { id: true, role: true, tenantId: true },
    });
    if (!user || user.role !== payload.role) return null;

    return { id: user.id, role: user.role, tenantId: user.tenantId };
  } catch {
    return null;
  }
}

// Require a specific role. Returns the user or a 403 NextResponse.
export async function requireRole(req: Request, roles: string[]): Promise<AuthUser | Response> {
  const user = await getAuthUser(req);
  if (!user || !roles.includes(user.role)) {
    return new Response(JSON.stringify({ error: "دسترسی غیرمجاز — این عملیات نیاز به دسترسی خاص دارد" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}
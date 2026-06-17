import { db } from "@/lib/db";

// Server-side role verification helper.
// Reads X-User-Id + X-User-Role from request headers (set by the client api() helper
// from the persisted session) and verifies against the database.
// In production this would use a real JWT/session — this is a lightweight demo gate.

export interface AuthUser {
  id: string;
  role: string;
  tenantId: string | null;
}

// Returns the authenticated user (verified against DB) or null.
export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role");
  if (!userId || !role) return null;
  // Verify the user exists and the role matches (prevents header spoofing for privilege escalation)
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, tenantId: true },
  });
  if (!user || user.role !== role) return null;
  return { id: user.id, role: user.role, tenantId: user.tenantId };
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

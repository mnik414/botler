import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";

// Returns the current session derived from the httpOnly cookie + DB.
export async function GET(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const user = await db.user.findUnique({
      where: { id: auth.id },
      include: { tenant: true },
    });
    if (!user) return unauthorized();

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            slug: user.tenant.slug,
            name: user.tenant.name,
            businessType: user.tenant.businessType,
            accentColor: user.tenant.accentColor,
          }
        : null,
    });
  } catch (e: any) {
    console.error("[auth/me]", e);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

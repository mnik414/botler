import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Lightweight demo auth. Returns a session object with role + tenant.
export async function POST(req: Request) {
  const { email, password } = await req.json();
  const user = await db.user.findUnique({
    where: { email: email?.toLowerCase() },
    include: { tenant: true },
  });
  if (!user || user.passwordHash !== password) {
    return NextResponse.json({ error: "ایمیل یا رمز عبور اشتباه است" }, { status: 401 });
  }
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
}

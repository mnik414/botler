import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-dev-secret-change-in-production");

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "ایمیل و رمز عبور را وارد کنید" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email: email?.toLowerCase() },
      include: { tenant: true },
    });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "ایمیل یا رمز عبور اشتباه است" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "ایمیل یا رمز عبور اشتباه است" }, { status: 401 });
    }

    // Create JWT (expires in 7 days)
    const token = await new SignJWT({
      sub: user.id,
      role: user.role,
      tenantId: user.tenantId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

    // Set HTTP-only cookie
    const response = NextResponse.json({
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

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (e: any) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

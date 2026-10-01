import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { signAuthToken } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Used to equalize response time for unknown accounts (anti user-enumeration).
const DUMMY_PASSWORD_HASH = "$2b$12$t2IIkOpzlh.ZbAxothK/j./mnELYB65i8NCUmebqUJDgxofIlutPC";

export async function POST(req: Request) {
  try {
    const limit = rateLimit(`login:${clientIp(req)}`, 10, 5 * 60_000);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSec, "تلاش‌های ورود بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.");

    const { email, password } = await req.json();
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return NextResponse.json({ error: "ایمیل و رمز عبور را وارد کنید" }, { status: 400 });
    }

    // Per-account throttle so distributed IPs cannot brute-force one account.
    const accountLimit = rateLimit(`login-account:${email.toLowerCase().slice(0, 200)}`, 20, 15 * 60_000);
    if (!accountLimit.ok) {
      return tooManyRequests(accountLimit.retryAfterSec, "تلاش‌های ورود برای این حساب بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.");
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { tenant: true },
    });
    if (!user || !user.passwordHash) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH).catch(() => {});
      return NextResponse.json({ error: "ایمیل یا رمز عبور اشتباه است" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "ایمیل یا رمز عبور اشتباه است" }, { status: 401 });
    }

    const token = await signAuthToken({
      id: user.id,
      role: user.role,
      tenantId: user.tenantId,
      tokenVersion: user.tokenVersion,
    });

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
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (e: any) {
    console.error("[auth/login]", e);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

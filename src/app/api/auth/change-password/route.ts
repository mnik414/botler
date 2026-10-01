import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getAuthUser, signAuthToken, unauthorized } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const limit = rateLimit(`change-password:${clientIp(req)}`, 10, 15 * 60_000);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { currentPassword, newPassword } = await req.json();
    if (typeof currentPassword !== "string" || typeof newPassword !== "string" || !currentPassword || !newPassword) {
      return NextResponse.json({ error: "رمز عبور فعلی و جدید را وارد کنید" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "رمز عبور جدید باید حداقل ۸ کاراکتر باشد" }, { status: 400 });
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!dbUser || !dbUser.passwordHash) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "رمز عبور فعلی اشتباه است" }, { status: 401 });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    // Bump tokenVersion to invalidate every other active session.
    const updated = await db.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, tokenVersion: { increment: 1 } },
      select: { id: true, role: true, tenantId: true, tokenVersion: true },
    });

    const response = NextResponse.json({ ok: true, message: "رمز عبور با موفقیت تغییر کرد" });
    const token = await signAuthToken(updated);
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch (e: any) {
    console.error("[auth/change-password]", e);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "لطفاً ابتدا وارد حساب خود شوید" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "رمز عبور فعلی و جدید را وارد کنید" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "رمز عبور جدید باید حداقل ۶ کاراکتر باشد" }, { status: 400 });
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

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ ok: true, message: "رمز عبور با موفقیت تغییر کرد" });
  } catch (e: any) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
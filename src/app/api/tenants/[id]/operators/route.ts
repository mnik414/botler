import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { isResponse, requireTenantOwner } from "@/lib/auth";

const ALLOWED_ROLES = ["operator", "business_owner"];

// List operators (and other users) for a tenant
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireTenantOwner(req, id);
  if (isResponse(auth)) return auth;

  const users = await db.user.findMany({
    where: { tenantId: auth.tenantId },
    select: { id: true, email: true, name: true, role: true, createdAt: true, avatarUrl: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
}

// Create a new operator (or business_owner) for a tenant
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireTenantOwner(req, id);
  if (isResponse(auth)) return auth;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const { name, email, password, role = "operator" } = body;
  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string" || !name.trim() || !email.trim() || !password) {
    return NextResponse.json({ error: "name, email, password required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "ایمیل معتبر وارد کنید" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "رمز عبور باید حداقل ۸ کاراکتر باشد" }, { status: 400 });
  }
  if (typeof role !== "string" || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "نقش کاربر نامعتبر است" }, { status: 400 });
  }
  // Only super admins may create additional business owners
  if (role === "business_owner" && auth.user.role !== "super_admin") {
    return NextResponse.json({ error: "فقط مدیر پلتفرم می‌تواند مالک کسب‌وکار جدید بسازد" }, { status: 403 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await db.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: {
      name: name.trim().slice(0, 200),
      email: normalizedEmail,
      passwordHash,
      role,
      tenantId: auth.tenantId,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json(user, { status: 201 });
}

// Delete an operator
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireTenantOwner(req, id);
  if (isResponse(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const target = await db.user.findFirst({ where: { id: userId, tenantId: auth.tenantId } });
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (target.role === "business_owner") {
    if (auth.user.role !== "super_admin") {
      return NextResponse.json({ error: "حذف مالک کسب‌وکار فقط توسط مدیر پلتفرم امکان‌پذیر است" }, { status: 403 });
    }
    const owners = await db.user.count({ where: { tenantId: auth.tenantId, role: "business_owner" } });
    if (owners <= 1) return NextResponse.json({ error: "نمی‌توان آخرین صاحب کسب‌وکار را حذف کرد" }, { status: 400 });
  }
  await db.user.delete({ where: { id: userId } });
  return NextResponse.json({ ok: true });
}

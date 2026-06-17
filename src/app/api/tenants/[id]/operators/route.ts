import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// List operators (and other users) for a tenant
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const users = await db.user.findMany({
    where: { tenantId: id },
    select: { id: true, email: true, name: true, role: true, createdAt: true, avatarUrl: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
}

// Create a new operator (or business_owner) for a tenant
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, email, password, role = "operator" } = body;
  if (!name || !email || !password) {
    return NextResponse.json({ error: "name, email, password required" }, { status: 400 });
  }
  // Check email uniqueness
  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 400 });

  const user = await db.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash: password,
      role,
      tenantId: id,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json(user, { status: 201 });
}

// Delete an operator
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  // Don't allow deleting the last owner
  const target = await db.user.findFirst({ where: { id: userId, tenantId: id } });
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (target.role === "business_owner") {
    const owners = await db.user.count({ where: { tenantId: id, role: "business_owner" } });
    if (owners <= 1) return NextResponse.json({ error: "نمی‌توان آخرین صاحب کسب‌وکار را حذف کرد" }, { status: 400 });
  }
  await db.user.delete({ where: { id: userId } });
  return NextResponse.json({ ok: true });
}

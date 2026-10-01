import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: Request) {
  // Server-side revocation: bump tokenVersion so the JWT cannot be replayed
  // even though it has not expired yet.
  try {
    const user = await getAuthUser(req);
    if (user) {
      await db.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      });
    }
  } catch (e) {
    console.error("[auth/logout] revocation failed", e);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}

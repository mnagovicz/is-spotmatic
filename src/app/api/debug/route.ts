import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { prisma } = await import("@/lib/prisma");
    const count = await prisma.user.count();
    return NextResponse.json({ ok: true, users: count });
  } catch (err) {
    return NextResponse.json({ 
      ok: false, 
      error: String(err),
      message: err instanceof Error ? err.message : 'unknown'
    }, { status: 500 });
  }
}

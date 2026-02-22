import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  exportCompName: z.string().optional(),
  controlCompName: z.string().optional(),
  isActive: z.boolean().optional(),
  color: z.string().nullable().optional(),
  aepFileUrl: z.string().optional(),
  aepFileName: z.string().optional(),
  aepFileSize: z.number().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const template = await prisma.template.findUnique({
    where: { id },
    include: {
      organization: true,
      variables: { orderBy: { sortOrder: "asc" } },
      footageSlots: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const template = await prisma.template.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(template);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const variableSchema = z.object({
  layerName: z.string().min(1),
  effectName: z.string().min(1),
  effectType: z.string().default("Slider"),
  type: z.enum(["SLIDER", "CHECKBOX", "TEXT", "IMAGE", "SELECT", "COLOR", "VOICEOVER"]),
  label: z.string().min(1),
  groupName: z.string().optional(),
  validation: z.any().optional(),
  defaultValue: z.string().optional(),
  sortOrder: z.number().default(0),
  row: z.number().default(0),
  lines: z.number().default(1),
  clientVisible: z.boolean().default(false),
  clientLabel: z.string().optional(),
});

const bulkSchema = z.object({
  variables: z.array(variableSchema),
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
  const variables = await prisma.templateVariable.findMany({
    where: { templateId: id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(variables);
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
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Replace all variables for this template
    await prisma.$transaction([
      prisma.templateVariable.deleteMany({ where: { templateId: id } }),
      ...parsed.data.variables.map((v, i) =>
        prisma.templateVariable.create({
          data: {
            ...v,
            templateId: id,
            sortOrder: v.sortOrder ?? i,
          },
        })
      ),
    ]);

    const variables = await prisma.templateVariable.findMany({
      where: { templateId: id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(variables);
  } catch (err) {
    console.error("Variables PUT error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

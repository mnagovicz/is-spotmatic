import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createJobSchema = z.object({
  templateId: z.string().min(1),
  organizationId: z.string().min(1),
  jobName: z.string().optional(),
  dueDate: z.string().optional(),
  broadcastDate: z.string().optional(),
  priority: z.number().default(0),
  data: z.record(z.string(), z.string()),
  draft: z.boolean().default(false),
  deliveryDestinationId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const templateId = searchParams.get("templateId");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = {};

  if (session.user.role === "CLIENT") {
    where.createdById = session.user.id;
  }

  if (status) where.status = status;
  if (templateId) where.templateId = templateId;

  const [jobs, total] = await Promise.all([
    prisma.renderJob.findMany({
      where,
      include: {
        template: true,
        createdBy: { select: { id: true, name: true, email: true } },
        agent: { select: { id: true, name: true } },
        deliveryDestination: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.renderJob.count({ where }),
  ]);

  return NextResponse.json({ jobs, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role === "OPERATOR") {
    return NextResponse.json({ error: "Operators cannot create jobs" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { templateId, organizationId, jobName, dueDate, broadcastDate, priority, data, draft, deliveryDestinationId } = parsed.data;

  const status = draft ? "DRAFT" : (session.user.role === "CLIENT" ? "AWAITING_APPROVAL" : "PENDING");

  const job = await prisma.renderJob.create({
    data: {
      templateId,
      organizationId,
      createdById: session.user.id,
      status,
      jobName,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      broadcastDate: broadcastDate ? new Date(broadcastDate) : undefined,
      priority,
      deliveryDestinationId: deliveryDestinationId || undefined,
      jobData: {
        create: Object.entries(data).map(([key, value]) => ({
          key,
          value: String(value),
        })),
      },
    },
    include: {
      template: true,
      jobData: true,
    },
  });

  return NextResponse.json(job, { status: 201 });
}

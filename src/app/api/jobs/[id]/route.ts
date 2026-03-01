import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const job = await prisma.renderJob.findUnique({
    where: { id },
    include: {
      template: {
        include: { variables: true, footageSlots: true },
      },
      createdBy: { select: { id: true, name: true, email: true } },
      agent: { select: { id: true, name: true, hostname: true } },
      jobData: true,
      jobAssets: true,
      deliveryDestination: { select: { id: true, name: true, type: true } },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (session.user.role === "CLIENT" && job.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(job);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const job = await prisma.renderJob.update({
    where: { id },
    data: body,
  });

  return NextResponse.json(job);
}

const updateDraftSchema = z.object({
  jobName: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  broadcastDate: z.string().nullable().optional(),
  data: z.record(z.string(), z.string()).optional(),
  submit: z.boolean().default(false),
  deliveryDestinationId: z.string().nullable().optional(),
  voiceoverVolumeDb: z.number().nullable().optional(),
  backgroundVolumeDb: z.number().nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existingJob = await prisma.renderJob.findUnique({
    where: { id },
  });

  if (!existingJob) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "OPERATOR";

  if (existingJob.createdById !== session.user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const isReviewEdit = isAdmin && existingJob.status === "REVIEW";

  if (existingJob.status !== "DRAFT" && !isReviewEdit) {
    return NextResponse.json({ error: "Only DRAFT or REVIEW jobs can be edited" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = updateDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { jobName, dueDate, broadcastDate, data, submit, deliveryDestinationId, voiceoverVolumeDb, backgroundVolumeDb } = parsed.data;

  const updatedJob = await prisma.$transaction(async (tx: typeof prisma) => {
    if (data) {
      await tx.jobData.deleteMany({ where: { jobId: id } });
      await tx.jobData.createMany({
        data: Object.entries(data).map(([key, value]) => ({
          jobId: id,
          key,
          value: String(value),
        })),
      });
    }

    return tx.renderJob.update({
      where: { id },
      data: {
        ...(jobName !== undefined && { jobName }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(broadcastDate !== undefined && { broadcastDate: broadcastDate ? new Date(broadcastDate) : null }),
        ...(deliveryDestinationId !== undefined && { deliveryDestinationId }),
        ...(voiceoverVolumeDb !== undefined && { voiceoverVolumeDb }),
        ...(backgroundVolumeDb !== undefined && { backgroundVolumeDb }),
        ...(submit && !isReviewEdit && { status: "AWAITING_APPROVAL" }),
        ...(submit && isReviewEdit && { status: "PENDING", progress: 0, agentId: null, errorMessage: null, startedAt: null, completedAt: null }),
      },
      include: {
        template: true,
        jobData: true,
      },
    });
  });

  return NextResponse.json(updatedJob);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const job = await prisma.renderJob.findUnique({
    where: { id },
  });

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (session.user.role === "CLIENT" && job.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (job.status !== "DRAFT" && job.status !== "AWAITING_APPROVAL") {
    return NextResponse.json({ error: "Only DRAFT or AWAITING_APPROVAL jobs can be deleted" }, { status: 400 });
  }

  await prisma.renderJob.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

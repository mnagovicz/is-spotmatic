import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const statusSchema = z.object({
  jobId: z.string(),
  status: z.enum(["DOWNLOADING", "GENERATING_TTS", "RENDERING", "MIXING", "UPLOADING", "COMPLETED", "FAILED"]),
  progress: z.number().min(0).max(100).optional(),
  errorMessage: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const agent = await prisma.renderAgent.findUnique({ where: { apiKey } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { jobId, status, progress, errorMessage } = parsed.data;

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (progress !== undefined) updateData.progress = progress;
  if (errorMessage) updateData.errorMessage = errorMessage;
  if (status === "COMPLETED") {
    updateData.completedAt = new Date();
    updateData.progress = 100;
  }
  if (status === "FAILED") {
    updateData.completedAt = new Date();
  }

  const job = await prisma.renderJob.update({
    where: { id: jobId },
    data: updateData,
  });

  // Update agent status if job completed/failed
  if (status === "COMPLETED" || status === "FAILED") {
    await prisma.renderAgent.update({
      where: { id: agent.id },
      data: { status: "online", currentJobId: null },
    });
  }

  return NextResponse.json(job);
}

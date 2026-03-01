import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function authenticateAgent(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return null;

  const agent = await prisma.renderAgent.findUnique({
    where: { apiKey },
  });
  return agent;
}

export async function GET(req: NextRequest) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  // Atomic job assignment with FOR UPDATE SKIP LOCKED
  const job = await prisma.$queryRaw<Array<{id: string}>>`
    UPDATE render_jobs
    SET status = 'DOWNLOADING',
        "agentId" = ${agent.id},
        "startedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE id = (
      SELECT id FROM render_jobs
      WHERE status = 'PENDING'
      ORDER BY priority DESC, "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `;

  if (!job || job.length === 0) {
    return NextResponse.json({ job: null });
  }

  // Update agent status
  await prisma.renderAgent.update({
    where: { id: agent.id },
    data: {
      status: "busy",
      currentJobId: job[0].id,
      lastHeartbeat: new Date(),
    },
  });

  // Fetch full job details
  const fullJob = await prisma.renderJob.findUnique({
    where: { id: job[0].id },
    include: {
      template: {
        include: { variables: true, footageSlots: true },
      },
      jobData: true,
      jobAssets: true,
    },
  });

  return NextResponse.json({ job: fullJob });
}

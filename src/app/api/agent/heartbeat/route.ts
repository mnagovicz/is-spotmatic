import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const agent = await prisma.renderAgent.findUnique({
    where: { apiKey },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const hostname = body.hostname as string | undefined;

  await prisma.renderAgent.update({
    where: { id: agent.id },
    data: {
      lastHeartbeat: new Date(),
      status: agent.status === "busy" ? "busy" : "online",
      ...(hostname ? { hostname } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

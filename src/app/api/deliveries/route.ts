import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["FTP", "SFTP", "WEBHOOK"]),
  host: z.string().optional(),
  port: z.number().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  path: z.string().optional(),
  webhookUrl: z.string().optional(),
  webhookHeaders: z.record(z.string(), z.string()).optional(),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const destinations = await prisma.deliveryDestination.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { templates: true } } },
    });

    return NextResponse.json(destinations);
  } catch (error) {
    console.error("GET /api/deliveries error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const destination = await prisma.deliveryDestination.create({
      data: parsed.data,
    });

    return NextResponse.json(destination, { status: 201 });
  } catch (error) {
    console.error("POST /api/deliveries error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

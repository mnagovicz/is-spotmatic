import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "OPERATOR", "CLIENT"]),
  organizationIds: z.array(z.string()).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      memberships: {
        select: {
          organization: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });

  const { name, email, password, role, organizationIds } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);

  // Determine which organizations to assign
  let membershipOrgIds: string[] = [];

  if (role === "CLIENT" && organizationIds && organizationIds.length > 0) {
    // Assign to selected organizations
    membershipOrgIds = organizationIds;
  } else {
    // Assign to default organization for ADMIN/OPERATOR or CLIENT without orgs
    let defaultOrg = await prisma.organization.findUnique({ where: { slug: "default" } });
    if (!defaultOrg) {
      defaultOrg = await prisma.organization.create({ data: { name: "Default", slug: "default" } });
    }
    membershipOrgIds = [defaultOrg.id];
  }

  const user = await prisma.user.create({
    data: {
      name, email, passwordHash, role,
      memberships: {
        create: membershipOrgIds.map((orgId) => ({ organizationId: orgId })),
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      memberships: {
        select: {
          organization: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  return NextResponse.json(user, { status: 201 });
}

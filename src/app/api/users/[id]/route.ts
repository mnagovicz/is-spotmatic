import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["ADMIN", "OPERATOR", "CLIENT"]).optional(),
  organizationIds: z.array(z.string()).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = patchUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });

  const { organizationIds, ...userFields } = parsed.data;

  // Update user fields (role, name)
  const user = await prisma.user.update({
    where: { id },
    data: userFields,
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

  // Update organization memberships if provided
  if (organizationIds !== undefined) {
    // Delete all existing memberships
    await prisma.organizationMember.deleteMany({ where: { userId: id } });

    let membershipOrgIds: string[] = organizationIds;

    // If empty array, assign to default org
    if (membershipOrgIds.length === 0) {
      let defaultOrg = await prisma.organization.findUnique({ where: { slug: "default" } });
      if (!defaultOrg) {
        defaultOrg = await prisma.organization.create({ data: { name: "Default", slug: "default" } });
      }
      membershipOrgIds = [defaultOrg.id];
    }

    // Create new memberships
    await prisma.organizationMember.createMany({
      data: membershipOrgIds.map((orgId) => ({ userId: id, organizationId: orgId })),
    });

    // Re-fetch user with updated memberships
    const updatedUser = await prisma.user.findUnique({
      where: { id },
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
    return NextResponse.json(updatedUser);
  }

  return NextResponse.json(user);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Prevent self-deletion
  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

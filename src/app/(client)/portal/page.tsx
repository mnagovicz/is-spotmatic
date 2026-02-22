import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalDashboard } from "./portal-dashboard";

export default async function PortalPage() {
  const session = await auth();
  if (!session?.user) return null;

  const where = { createdById: session.user.id };

  const [total, drafts, awaiting, inProgress, completed, rejected] = await Promise.all([
    prisma.renderJob.count({ where }),
    prisma.renderJob.count({ where: { ...where, status: "DRAFT" } }),
    prisma.renderJob.count({ where: { ...where, status: "AWAITING_APPROVAL" } }),
    prisma.renderJob.count({
      where: { ...where, status: { in: ["PENDING", "DOWNLOADING", "RENDERING", "UPLOADING"] } },
    }),
    prisma.renderJob.count({ where: { ...where, status: "COMPLETED" } }),
    prisma.renderJob.count({ where: { ...where, status: "REJECTED" } }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentOrders: any[] = await prisma.renderJob.findMany({
    where,
    orderBy: { dueDate: { sort: "asc", nulls: "last" } },
    take: 10,
    include: {
      template: true,
      deliveryDestination: { select: { id: true, name: true } },
    },
  });

  return (
    <PortalDashboard
      userName={session.user.name || ""}
      total={total}
      drafts={drafts}
      awaiting={awaiting}
      inProgress={inProgress}
      completed={completed}
      rejected={rejected}
      recentOrders={recentOrders.map((order) => ({
        id: order.id,
        jobName: order.jobName,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        dueDate: order.dueDate?.toISOString() || null,
        broadcastDate: order.broadcastDate?.toISOString() || null,
        deliveryDestinationName: order.deliveryDestination?.name || null,
        templateName: order.template?.name || "—",
      }))}
    />
  );
}

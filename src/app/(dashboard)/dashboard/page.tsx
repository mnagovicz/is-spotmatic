import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardContent } from "./dashboard-content";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const isClient = session.user.role === "CLIENT";

  const whereClause = isClient ? { createdById: session.user.id } : {};

  const [totalJobs, completedJobs, pendingJobs, failedJobs, awaitingApproval] =
    await Promise.all([
      prisma.renderJob.count({ where: whereClause }),
      prisma.renderJob.count({ where: { ...whereClause, status: "COMPLETED" } }),
      prisma.renderJob.count({
        where: { ...whereClause, status: { in: ["PENDING", "DOWNLOADING", "RENDERING", "UPLOADING"] } },
      }),
      prisma.renderJob.count({ where: { ...whereClause, status: "FAILED" } }),
      prisma.renderJob.count({ where: { status: "AWAITING_APPROVAL" } }),
    ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentJobs: any[] = await prisma.renderJob.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { template: true, createdBy: true },
  });

  return (
    <DashboardContent
      totalJobs={totalJobs}
      completedJobs={completedJobs}
      pendingJobs={pendingJobs}
      failedJobs={failedJobs}
      awaitingApproval={isClient ? undefined : awaitingApproval}
      recentJobs={recentJobs.map((job) => ({
        id: job.id,
        jobName: job.jobName,
        status: job.status,
        createdAt: job.createdAt.toISOString(),
        templateName: job.template.name,
        createdByName: job.createdBy.name,
      }))}
    />
  );
}

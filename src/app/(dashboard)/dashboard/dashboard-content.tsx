"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileVideo, CheckCircle, Clock, AlertTriangle, Hourglass } from "lucide-react";
import Link from "next/link";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { useTranslation } from "@/lib/i18n";
import { JobStatus } from "@/generated/prisma/client";

interface RecentJob {
  id: string;
  jobName: string | null;
  status: JobStatus;
  createdAt: string;
  templateName: string;
  createdByName: string | null;
}

interface DashboardContentProps {
  totalJobs: number;
  completedJobs: number;
  pendingJobs: number;
  failedJobs: number;
  awaitingApproval?: number;
  recentJobs: RecentJob[];
}

export function DashboardContent({
  totalJobs,
  completedJobs,
  pendingJobs,
  failedJobs,
  awaitingApproval,
  recentJobs,
}: DashboardContentProps) {
  const { t } = useTranslation();

  const stats = [
    { labelKey: "dashboard.totalJobs", value: totalJobs, icon: FileVideo, color: "text-blue-600" },
    ...(awaitingApproval !== undefined
      ? [{ labelKey: "dashboard.awaitingApproval", value: awaitingApproval, icon: Hourglass, color: "text-orange-600" }]
      : []),
    { labelKey: "dashboard.completed", value: completedJobs, icon: CheckCircle, color: "text-green-600" },
    { labelKey: "dashboard.inProgress", value: pendingJobs, icon: Clock, color: "text-yellow-600" },
    { labelKey: "dashboard.failed", value: failedJobs, icon: AlertTriangle, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.labelKey}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(stat.labelKey)}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.recentJobs")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.noJobs")}</p>
          ) : (
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-muted"
                >
                  <div>
                    <p className="font-medium">
                      {job.jobName || job.templateName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {job.createdByName} &middot;{" "}
                      {new Date(job.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <JobStatusBadge status={job.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

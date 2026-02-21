"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { useTranslation } from "@/lib/i18n";
import { JobStatus } from "@/generated/prisma/client";
import {
  FileVideo,
  Clock,
  CheckCircle,
  XCircle,
  Hourglass,
  Plus,
} from "lucide-react";
import Link from "next/link";

interface RecentOrder {
  id: string;
  jobName: string | null;
  status: JobStatus;
  createdAt: string;
  templateName: string;
}

interface PortalDashboardProps {
  userName: string;
  total: number;
  awaiting: number;
  inProgress: number;
  completed: number;
  rejected: number;
  recentOrders: RecentOrder[];
}

export function PortalDashboard({
  userName,
  total,
  awaiting,
  inProgress,
  completed,
  rejected,
  recentOrders,
}: PortalDashboardProps) {
  const { t } = useTranslation();

  const stats = [
    { labelKey: "portal.totalOrders", value: total, icon: FileVideo, color: "text-blue-600" },
    { labelKey: "portal.awaitingApproval", value: awaiting, icon: Hourglass, color: "text-orange-600" },
    { labelKey: "portal.inProgress", value: inProgress, icon: Clock, color: "text-yellow-600" },
    { labelKey: "portal.completed", value: completed, icon: CheckCircle, color: "text-green-600" },
    { labelKey: "portal.rejected", value: rejected, icon: XCircle, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("portal.welcome", { name: userName })}</h1>
        </div>
        <Link href="/portal/templates">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("portal.newOrder")}
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
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
          <CardTitle>{t("portal.recentOrders")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("portal.noOrders")}</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/portal/orders/${order.id}`}
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-muted"
                >
                  <div>
                    <p className="font-medium">
                      {order.jobName || order.templateName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <JobStatusBadge status={order.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

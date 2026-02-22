"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  FileEdit,
  ChevronDown,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface RecentOrder {
  id: string;
  jobName: string | null;
  status: JobStatus;
  createdAt: string;
  dueDate: string | null;
  broadcastDate: string | null;
  deliveryDestinationName: string | null;
  templateName: string;
}

interface PortalDashboardProps {
  userName: string;
  total: number;
  drafts: number;
  awaiting: number;
  inProgress: number;
  completed: number;
  rejected: number;
  recentOrders: RecentOrder[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface TemplateVariable {
  id: string;
  label: string;
  clientVisible: boolean;
  clientLabel: string | null;
  row: number;
}

interface JobData {
  id: string;
  key: string;
  value: string;
}

function ExpandedRow({ jobId }: { jobId: string }) {
  const { data: job } = useSWR(`/api/jobs/${jobId}`, fetcher);
  const { t } = useTranslation();

  if (!job) return (
    <TableRow>
      <TableCell colSpan={8} className="bg-muted/30 py-3 px-8">
        {t("common.loading")}
      </TableCell>
    </TableRow>
  );

  const variables: TemplateVariable[] = job.template?.variables || [];
  const jobData: JobData[] = job.jobData || [];
  const visibleVars = variables.filter((v) => v.clientVisible);

  if (visibleVars.length === 0) return null;

  const rows = visibleVars.reduce((acc, v) => {
    const r = v.row ?? 0;
    if (!acc[r]) acc[r] = [];
    acc[r].push(v);
    return acc;
  }, {} as Record<number, TemplateVariable[]>);

  return (
    <TableRow>
      <TableCell colSpan={8} className="bg-muted/30 p-0">
        <div className="space-y-1 px-8 py-3">
          {Object.entries(rows)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([rowNum, vars]) => (
              <div key={rowNum} className="flex flex-wrap gap-6">
                {vars.map((v) => {
                  const data = jobData.find((d) => d.key === v.id);
                  return (
                    <div key={v.id} className="text-sm">
                      <span className="text-muted-foreground">{v.clientLabel || v.label}: </span>
                      <span className="font-medium">{data?.value || "—"}</span>
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

function RecentOrdersTable({ recentOrders }: { recentOrders: RecentOrder[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { t } = useTranslation();
  const router = useRouter();

  async function handleDelete(jobId: string) {
    if (!confirm(t("portal.order.deleteConfirm"))) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("toast.orderDeleted"));
      router.refresh();
    } catch {
      toast.error(t("toast.orderDeleteFailed"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("portal.recentOrders")}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {recentOrders.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">{t("portal.noOrders")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("portal.orders.order")}</TableHead>
                <TableHead>{t("portal.orders.template")}</TableHead>
                <TableHead>{t("portal.orders.broadcastDate")}</TableHead>
                <TableHead>{t("portal.orders.deliveryDestination")}</TableHead>
                <TableHead>{t("portal.orders.dueDate")}</TableHead>
                <TableHead>{t("portal.orders.status")}</TableHead>
                <TableHead>{t("portal.orders.created")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.map((order) => (
                <>
                  <TableRow
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedId(expandedId === order.id ? null : order.id)
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${
                            expandedId === order.id ? "rotate-180" : ""
                          }`}
                        />
                        <span className="font-medium">
                          {order.jobName || order.id.slice(0, 8)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{order.templateName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.broadcastDate ? format(new Date(order.broadcastDate), "d.M.yyyy HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.deliveryDestinationName || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.dueDate ? format(new Date(order.dueDate), "d.M.yyyy HH:mm") : "—"}
                    </TableCell>
                    <TableCell>
                      <JobStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(order.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {order.status === "DRAFT" && (
                          <Link
                            href={`/portal/orders/${order.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </Link>
                        )}
                        {(order.status === "DRAFT" || order.status === "AWAITING_APPROVAL") && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(order.id); }}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === order.id && (
                    <ExpandedRow key={`${order.id}-detail`} jobId={order.id} />
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function PortalDashboard({
  userName,
  total,
  drafts,
  awaiting,
  inProgress,
  completed,
  rejected,
  recentOrders,
}: PortalDashboardProps) {
  const { t } = useTranslation();

  const stats = [
    { labelKey: "portal.totalOrders", value: total, icon: FileVideo, color: "text-blue-600" },
    { labelKey: "portal.drafts", value: drafts, icon: FileEdit, color: "text-gray-600" },
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

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
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

      <RecentOrdersTable recentOrders={recentOrders} />
    </div>
  );
}

"use client";

import useSWR from "swr";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "@/lib/i18n";
import { JobStatus } from "@/generated/prisma/client";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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
      <TableCell colSpan={5} className="bg-muted/30 py-3 px-8">
        {t("common.loading")}
      </TableCell>
    </TableRow>
  );

  const variables: TemplateVariable[] = job.template?.variables || [];
  const jobData: JobData[] = job.jobData || [];

  // Only show client-visible variables
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
      <TableCell colSpan={5} className="bg-muted/30 p-0">
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

export default function PortalOrdersPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryParams = statusFilter !== "all" ? `?status=${statusFilter}` : "";
  const { data, mutate } = useSWR(`/api/jobs${queryParams}`, fetcher, {
    refreshInterval: 5000,
  });
  const { t } = useTranslation();

  async function handleDelete(jobId: string) {
    if (!confirm(t("portal.order.deleteConfirm"))) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("toast.orderDeleted"));
      mutate();
    } catch {
      toast.error(t("toast.orderDeleteFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("portal.orders.title")}</h1>

      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("jobs.filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("jobs.allStatuses")}</SelectItem>
            <SelectItem value="DRAFT">{t("status.draft")}</SelectItem>
            <SelectItem value="AWAITING_APPROVAL">{t("status.awaitingApproval")}</SelectItem>
            <SelectItem value="PENDING">{t("status.pending")}</SelectItem>
            <SelectItem value="RENDERING">{t("status.rendering")}</SelectItem>
            <SelectItem value="COMPLETED">{t("status.completed")}</SelectItem>
            <SelectItem value="REJECTED">{t("status.rejected")}</SelectItem>
            <SelectItem value="FAILED">{t("status.failed")}</SelectItem>
          </SelectContent>
        </Select>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.total} {t("jobs.jobsTotal")}
          </span>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("portal.orders.order")}</TableHead>
                <TableHead>{t("portal.orders.template")}</TableHead>
                <TableHead>{t("portal.orders.status")}</TableHead>
                <TableHead>{t("portal.orders.created")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.jobs?.map(
                (job: {
                  id: string;
                  jobName: string | null;
                  status: JobStatus;
                  createdAt: string;
                  template: { name: string } | null;
                }) => (
                  <>
                    <TableRow
                      key={job.id}
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedId(expandedId === job.id ? null : job.id)
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform ${
                              expandedId === job.id ? "rotate-180" : ""
                            }`}
                          />
                          <span className="font-medium">
                            {job.jobName || job.id.slice(0, 8)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{job.template?.name ?? "—"}</TableCell>
                      <TableCell>
                        <JobStatusBadge status={job.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(job.createdAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {job.status === "DRAFT" && (
                            <Link
                              href={`/portal/orders/${job.id}/edit`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </Link>
                          )}
                          {(job.status === "DRAFT" || job.status === "AWAITING_APPROVAL") && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(job.id); }}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === job.id && (
                      <ExpandedRow key={`${job.id}-detail`} jobId={job.id} />
                    )}
                  </>
                )
              )}
              {(!data?.jobs || data.jobs.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    {t("portal.orders.noOrders")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

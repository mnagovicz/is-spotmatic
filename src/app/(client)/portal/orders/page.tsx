"use client";

import useSWR from "swr";
import Link from "next/link";
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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function PortalOrdersPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const queryParams = statusFilter !== "all" ? `?status=${statusFilter}` : "";
  const { data } = useSWR(`/api/jobs${queryParams}`, fetcher, {
    refreshInterval: 5000,
  });
  const { t } = useTranslation();

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.jobs?.map(
                (job: {
                  id: string;
                  jobName: string | null;
                  status: JobStatus;
                  createdAt: string;
                  template: { name: string };
                }) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link
                        href={`/portal/orders/${job.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {job.jobName || job.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>{job.template.name}</TableCell>
                    <TableCell>
                      <JobStatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(job.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                  </TableRow>
                )
              )}
              {(!data?.jobs || data.jobs.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={4}
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

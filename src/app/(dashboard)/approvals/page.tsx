"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Check, X, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ApprovalsPage() {
  const { data, mutate } = useSWR(
    "/api/jobs?status=AWAITING_APPROVAL",
    fetcher,
    { refreshInterval: 10000 }
  );
  const { t } = useTranslation();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectJobId, setRejectJobId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  async function handleApprove(jobId: string) {
    setApproving(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/approve`, { method: "POST" });
      if (res.ok) {
        toast.success(t("toast.jobApproved"));
        mutate();
      } else {
        toast.error(t("toast.jobApproveFailed"));
      }
    } catch {
      toast.error(t("toast.jobApproveFailed"));
    }
    setApproving(null);
  }

  function openRejectDialog(jobId: string) {
    setRejectJobId(jobId);
    setRejectReason("");
    setRejectDialogOpen(true);
  }

  async function handleReject() {
    if (!rejectJobId || !rejectReason.trim()) return;
    setRejecting(true);
    try {
      const res = await fetch(`/api/jobs/${rejectJobId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (res.ok) {
        toast.success(t("toast.jobRejected"));
        setRejectDialogOpen(false);
        mutate();
      } else {
        toast.error(t("toast.jobRejectFailed"));
      }
    } catch {
      toast.error(t("toast.jobRejectFailed"));
    }
    setRejecting(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("approvals.title")}</h1>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("approvals.order")}</TableHead>
                <TableHead>{t("approvals.template")}</TableHead>
                <TableHead>{t("approvals.client")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("approvals.created")}</TableHead>
                <TableHead>{t("approvals.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.jobs?.map(
                (job: {
                  id: string;
                  jobName: string | null;
                  status: "AWAITING_APPROVAL";
                  createdAt: string;
                  template: { name: string };
                  createdBy: { name: string | null; email: string };
                }) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {job.jobName || job.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>{job.template.name}</TableCell>
                    <TableCell>
                      {job.createdBy.name || job.createdBy.email}
                    </TableCell>
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
                        <Link href={`/jobs/${job.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(job.id)}
                          disabled={approving === job.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="mr-1 h-4 w-4" />
                          {approving === job.id
                            ? t("approvals.approving")
                            : t("approvals.approve")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openRejectDialog(job.id)}
                        >
                          <X className="mr-1 h-4 w-4" />
                          {t("approvals.reject")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
              {(!data?.jobs || data.jobs.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    {t("approvals.noApprovals")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("approvals.rejectDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("approvals.rejectDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("approvals.rejectDialog.reason")}</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("approvals.rejectDialog.reasonPlaceholder")}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting || !rejectReason.trim()}
            >
              {rejecting
                ? t("approvals.rejecting")
                : t("approvals.rejectDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

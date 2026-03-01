"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { DynamicForm } from "@/components/dynamic-form/dynamic-form";
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
import { toast } from "sonner";
import {
  Download,
  RefreshCw,
  UserCheck,
  Clock,
  Server,
  AlertTriangle,
  RotateCcw,
  Play,
  CheckCircle,
  XCircle,
  Wrench,
  Edit3,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "@/lib/i18n";
import { useEffect, useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: job, mutate } = useSWR(`/api/jobs/${id}`, fetcher, {
    refreshInterval: (data) => {
      if (!data) return 5000;
      if (["COMPLETED", "FAILED", "MANUAL", "REVIEW", "REJECTED"].includes(data.status)) return 0;
      if (["RENDERING", "GENERATING_TTS", "MIXING"].includes(data.status)) return 2000;
      return 5000;
    },
  });
  const { t } = useTranslation();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRerenderForm, setShowRerenderForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if ((job?.status === "COMPLETED" || job?.status === "REVIEW") && job?.outputMp4Url && !videoUrl) {
      fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: job.outputMp4Url, action: "download" }),
      })
        .then((r) => r.json())
        .then((data) => setVideoUrl(data.url))
        .catch(() => {});
    }
  }, [job?.status, job?.outputMp4Url]);

  async function handleTakeover() {
    const res = await fetch(`/api/jobs/${id}/takeover`, { method: "POST" });
    if (res.ok) {
      toast.success(t("toast.jobTakeover"));
      mutate();
    } else {
      toast.error(t("toast.jobTakeoverFailed"));
    }
  }

  async function handleRetry() {
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "PENDING",
        progress: 0,
        agentId: null,
        errorMessage: null,
      }),
    });
    if (res.ok) {
      toast.success(t("toast.jobRequeued"));
      mutate();
    }
  }

  async function handleRerender() {
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "PENDING",
        progress: 0,
        agentId: null,
        errorMessage: null,
        completedAt: null,
        startedAt: null,
      }),
    });
    if (res.ok) {
      toast.success(t("toast.jobRequeued"));
      mutate();
    }
  }

  async function handleDownload(fileKey: string, filename: string) {
    const res = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: fileKey, action: "download" }),
    });
    const { url: downloadUrl } = await res.json();
    const blob = await fetch(downloadUrl).then((r) => r.blob());
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  async function handleApprove() {
    setActionLoading("approve");
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    setActionLoading(null);
    if (res.ok) {
      toast.success(t("toast.jobApproved"));
      mutate();
    }
  }

  async function handleReject() {
    setActionLoading("reject");
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REJECTED", rejectionReason: rejectReason }),
    });
    setActionLoading(null);
    if (res.ok) {
      toast.success(t("toast.jobRejected"));
      setShowRejectDialog(false);
      setRejectReason("");
      mutate();
    }
  }

  async function handleToManual() {
    setActionLoading("manual");
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "MANUAL" }),
    });
    setActionLoading(null);
    if (res.ok) {
      toast.success(t("toast.jobToManual"));
      mutate();
    }
  }

  async function handleRerenderWithData(data: Record<string, string>) {
    setActionLoading("rerender");
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, submit: true }),
    });
    setActionLoading(null);
    if (res.ok) {
      toast.success(t("toast.jobRequeued"));
      setShowRerenderForm(false);
      setVideoUrl(null);
      mutate();
    }
  }

  if (!job) {
    return <div>{t("common.loading")}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {job.jobName || `${t("jobs.job")} ${job.id.slice(0, 8)}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("jobs.detail.template")}: {job.template?.name}
          </p>
        </div>
        <JobStatusBadge status={job.status} />
      </div>

      {/* Progress */}
      {["DOWNLOADING", "GENERATING_TTS", "RENDERING", "MIXING", "UPLOADING"].includes(job.status) && (
        <Card>
          <CardContent className="py-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{job.status}</span>
                <span>{job.progress}%</span>
              </div>
              <Progress value={job.progress} className="h-3" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {job.status === "FAILED" && job.errorMessage && (
        <Card className="border-red-200 bg-destructive/10 dark:border-red-800">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">{t("jobs.detail.renderFailed")}</p>
              <p className="text-sm text-destructive/80">{job.errorMessage}</p>
              <p className="mt-1 text-xs text-destructive/60">
                Retry {job.retryCount}/{job.maxRetries}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video Preview */}
      {(job.status === "COMPLETED" || job.status === "REVIEW") && videoUrl && (
        <Card>
          <CardContent className="p-4">
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg"
              preload="metadata"
            />
          </CardContent>
        </Card>
      )}

      {/* Review Actions */}
      {job.status === "REVIEW" && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleApprove} disabled={!!actionLoading}>
                <CheckCircle className="mr-2 h-4 w-4" /> {t("jobs.detail.approve")}
              </Button>
              <Button variant="outline" onClick={() => setShowRerenderForm(!showRerenderForm)} disabled={!!actionLoading}>
                <Edit3 className="mr-2 h-4 w-4" /> {t("jobs.detail.rerenderWithEdit")}
              </Button>
              <Button variant="outline" onClick={handleToManual} disabled={!!actionLoading}>
                <Wrench className="mr-2 h-4 w-4" /> {t("jobs.detail.toManual")}
              </Button>
              <Button variant="destructive" onClick={() => setShowRejectDialog(true)} disabled={!!actionLoading}>
                <XCircle className="mr-2 h-4 w-4" /> {t("jobs.detail.reject")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Re-render with edit form */}
      {showRerenderForm && job.status === "REVIEW" && job.template && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("jobs.detail.rerenderWithEdit")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DynamicForm
              variables={job.template.variables || []}
              footageSlots={job.template.footageSlots || []}
              defaultValues={Object.fromEntries(
                (job.jobData || []).map((d: { key: string; value: string }) => [d.key, d.value])
              )}
              onSubmit={(data) => handleRerenderWithData(data)}
              loading={actionLoading === "rerender"}
              submitLabel={t("jobs.detail.confirmRerender")}
            />
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("jobs.detail.reject")}</DialogTitle>
            <DialogDescription>{t("approvals.rejectDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("jobs.detail.rejectReason")}</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("approvals.rejectDialog.reasonPlaceholder")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading === "reject"}>
              {t("jobs.detail.reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Actions */}
      <div className="flex gap-3">
        {job.status === "COMPLETED" && (
          <>
            {job.outputMp4Url && (
              <Button
                onClick={() => handleDownload(job.outputMp4Url, "output.mp4")}
              >
                <Download className="mr-2 h-4 w-4" /> {t("jobs.detail.downloadMp4")}
              </Button>
            )}
            {job.outputAepUrl && (
              <Button
                variant="outline"
                onClick={() => handleDownload(job.outputAepUrl, "output.aep")}
              >
                <Download className="mr-2 h-4 w-4" /> {t("jobs.detail.downloadAep")}
              </Button>
            )}
            <Button variant="outline" onClick={handleRerender}>
              <RotateCcw className="mr-2 h-4 w-4" /> {t("jobs.detail.rerender")}
            </Button>
          </>
        )}
        {(job.status === "REVIEW") && (
          <>
            {job.outputMp4Url && (
              <Button
                variant="outline"
                onClick={() => handleDownload(job.outputMp4Url, "output.mp4")}
              >
                <Download className="mr-2 h-4 w-4" /> {t("jobs.detail.downloadMp4")}
              </Button>
            )}
            {job.outputAepUrl && (
              <Button
                variant="outline"
                onClick={() => handleDownload(job.outputAepUrl, "output.aep")}
              >
                <Download className="mr-2 h-4 w-4" /> {t("jobs.detail.downloadAep")}
              </Button>
            )}
          </>
        )}
        {job.status === "FAILED" && (
          <>
            <Button onClick={handleRetry}>
              <RefreshCw className="mr-2 h-4 w-4" /> {t("jobs.detail.retry")}
            </Button>
            <Button variant="outline" onClick={handleRerender}>
              <RotateCcw className="mr-2 h-4 w-4" /> {t("jobs.detail.rerender")}
            </Button>
            <Button variant="outline" onClick={handleTakeover}>
              <UserCheck className="mr-2 h-4 w-4" /> {t("jobs.detail.manualTakeover")}
            </Button>
          </>
        )}
        {job.status === "PENDING" && (
          <Button variant="outline" onClick={handleTakeover}>
            <UserCheck className="mr-2 h-4 w-4" /> {t("jobs.detail.manualTakeover")}
          </Button>
        )}
      </div>

      <Separator />

      {/* Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("jobs.detail.jobInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("jobs.detail.id")}</span>
              <span className="font-mono">{job.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("jobs.detail.createdBy")}</span>
              <span>{job.createdBy?.name || job.createdBy?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("jobs.detail.priority")}</span>
              <span>{job.priority}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("jobs.detail.created")}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(job.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
            {job.startedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("jobs.detail.started")}</span>
                <span>
                  {formatDistanceToNow(new Date(job.startedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            )}
            {job.completedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("jobs.detail.completed")}</span>
                <span>
                  {formatDistanceToNow(new Date(job.completedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            )}
            {job.agent && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("jobs.detail.agent")}</span>
                <Badge variant="outline">
                  <Server className="mr-1 h-3 w-3" />
                  {job.agent.name}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("jobs.detail.jobData")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {job.jobData?.map(
              (d: { id: string; key: string; value: string }) => (
                <div key={d.id} className="flex justify-between">
                  <span className="text-muted-foreground">{d.key}</span>
                  <span className="font-mono">{d.value}</span>
                </div>
              )
            )}
            {(!job.jobData || job.jobData.length === 0) && (
              <p className="text-muted-foreground">{t("jobs.detail.noData")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

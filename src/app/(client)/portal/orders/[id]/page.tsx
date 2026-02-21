"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Download, Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "@/lib/i18n";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function PortalOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: job } = useSWR(`/api/jobs/${id}`, fetcher, {
    refreshInterval: (data) => {
      if (!data) return 5000;
      if (["COMPLETED", "FAILED", "REJECTED", "MANUAL"].includes(data.status))
        return 0;
      return 5000;
    },
  });
  const { t } = useTranslation();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  async function handleDownload(url: string, filename: string) {
    const res = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: url, action: "download" }),
    });
    const { url: downloadUrl } = await res.json();
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    a.click();
  }

  async function loadVideo(url: string) {
    const res = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: url, action: "download" }),
    });
    const { url: presignedUrl } = await res.json();
    setVideoUrl(presignedUrl);
  }

  if (!job) {
    return <div>{t("common.loading")}</div>;
  }

  if (job.status === "COMPLETED" && job.outputMp4Url && !videoUrl) {
    loadVideo(job.outputMp4Url);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {job.jobName || `${t("portal.orders.order")} ${job.id.slice(0, 8)}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("portal.order.template")}: {job.template?.name}
          </p>
        </div>
        <JobStatusBadge status={job.status} />
      </div>

      {/* Rejection reason */}
      {job.status === "REJECTED" && job.rejectionReason && (
        <Card className="border-red-200 bg-destructive/10 dark:border-red-800">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">
                {t("portal.orders.detail.rejectionReason")}
              </p>
              <p className="text-sm text-destructive/80">
                {job.rejectionReason}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video player */}
      {job.status === "COMPLETED" && videoUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t("portal.orders.detail.videoPreview")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg"
              preload="metadata"
            />
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {job.status === "COMPLETED" && job.outputMp4Url && (
        <div className="flex gap-3">
          <Button
            onClick={() => handleDownload(job.outputMp4Url, "output.mp4")}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("portal.orders.detail.downloadVideo")}
          </Button>
        </div>
      )}

      <Separator />

      {/* Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t("portal.orders.detail.orderInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("portal.orders.detail.id")}
              </span>
              <span className="font-mono">{job.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t("portal.orders.detail.created")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(job.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
            {job.completedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("portal.orders.detail.completed")}
                </span>
                <span>
                  {formatDistanceToNow(new Date(job.completedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t("portal.orders.detail.orderData")}
            </CardTitle>
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
              <p className="text-muted-foreground">
                {t("portal.orders.detail.noData")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

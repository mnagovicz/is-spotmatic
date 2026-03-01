"use client";

import useSWR from "swr";
import Link from "next/link";
import React, { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Progress } from "@/components/ui/progress";
import { Plus, ChevronDown, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface TemplateVariable {
  id: string;
  label: string;
  clientVisible: boolean;
  clientLabel: string | null;
}

interface JobData {
  id: string;
  key: string;
  value: string;
}

function ExpandedRow({ jobId }: { jobId: string }) {
  const { data: job } = useSWR(`/api/jobs/${jobId}`, fetcher);
  const { t } = useTranslation();
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (job?.status === "COMPLETED" && job?.outputMp4Url && !videoUrl) {
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

  if (!job) return (
    <TableRow>
      <TableCell colSpan={7} className="bg-muted/30 py-3 px-8">
        {t("common.loading")}
      </TableCell>
    </TableRow>
  );

  const variables: TemplateVariable[] = job.template?.variables || [];
  const jobData: JobData[] = job.jobData || [];

  const visibleVars = variables.filter((v) => v.clientVisible);

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

  return (
    <TableRow>
      <TableCell colSpan={7} className="bg-muted/30 p-0">
        <div className="space-y-3 px-8 py-3">
          {visibleVars.length > 0 && (
            <div className="flex flex-wrap gap-6">
              {visibleVars.map((v) => {
                const data = jobData.find((d) => d.key === v.id);
                return (
                  <div key={v.id} className="text-sm">
                    <span className="text-muted-foreground">{v.clientLabel || v.label}: </span>
                    <span className="font-medium">{data?.value || "—"}</span>
                  </div>
                );
              })}
            </div>
          )}
          {job.status === "COMPLETED" && videoUrl && (
            <div className="max-w-2xl">
              <video src={videoUrl} controls className="w-full rounded-lg" preload="metadata" />
            </div>
          )}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {job.status === "COMPLETED" && job.outputMp4Url && (
              <Button size="sm" onClick={() => handleDownload(job.outputMp4Url, `${job.jobName || job.id}.mp4`)}>
                <Download className="mr-2 h-3 w-3" /> {t("jobs.detail.downloadMp4")}
              </Button>
            )}
            <Link href={`/jobs/${jobId}`}>
              <Button size="sm" variant="outline">
                {t("jobs.detail.jobInfo")}
              </Button>
            </Link>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function JobsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryParams = statusFilter !== "all" ? `?status=${statusFilter}` : "";
  const { data } = useSWR(`/api/jobs${queryParams}`, fetcher, {
    refreshInterval: 5000,
  });
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("jobs.title")}</h1>
        <Link href="/jobs/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> {t("jobs.newJob")}
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("jobs.filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("jobs.allStatuses")}</SelectItem>
            <SelectItem value="AWAITING_APPROVAL">{t("status.awaitingApproval")}</SelectItem>
            <SelectItem value="PENDING">{t("status.pending")}</SelectItem>
            <SelectItem value="DOWNLOADING">{t("status.downloading")}</SelectItem>
            <SelectItem value="RENDERING">{t("status.rendering")}</SelectItem>
            <SelectItem value="UPLOADING">{t("status.uploading")}</SelectItem>
            <SelectItem value="COMPLETED">{t("status.completed")}</SelectItem>
            <SelectItem value="FAILED">{t("status.failed")}</SelectItem>
            <SelectItem value="REJECTED">{t("status.rejected")}</SelectItem>
            <SelectItem value="MANUAL">{t("status.manual")}</SelectItem>
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
                <TableHead>{t("jobs.job")}</TableHead>
                <TableHead>{t("jobs.template")}</TableHead>
                <TableHead>{t("jobs.createdBy")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("jobs.progress")}</TableHead>
                <TableHead>{t("jobs.agent")}</TableHead>
                <TableHead>{t("jobs.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.jobs?.map(
                (job: {
                  id: string;
                  jobName: string | null;
                  status: "AWAITING_APPROVAL" | "PENDING" | "DOWNLOADING" | "RENDERING" | "UPLOADING" | "COMPLETED" | "FAILED" | "REJECTED" | "MANUAL";
                  progress: number;
                  createdAt: string;
                  template: { name: string };
                  createdBy: { name: string | null; email: string };
                  agent: { name: string } | null;
                }) => (
                  <React.Fragment key={job.id}>
                    <TableRow
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
                      <TableCell>{job.template.name}</TableCell>
                      <TableCell>
                        {job.createdBy.name || job.createdBy.email}
                      </TableCell>
                      <TableCell>
                        <JobStatusBadge status={job.status} />
                      </TableCell>
                      <TableCell>
                        {["DOWNLOADING", "RENDERING", "UPLOADING"].includes(
                          job.status
                        ) ? (
                          <Progress value={job.progress} className="w-24" />
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {job.progress}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {job.agent?.name || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(job.createdAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                    </TableRow>
                    {expandedId === job.id && (
                      <ExpandedRow key={`${job.id}-detail`} jobId={job.id} />
                    )}
                  </React.Fragment>
                )
              )}
              {(!data?.jobs || data.jobs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t("jobs.noJobs")}
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

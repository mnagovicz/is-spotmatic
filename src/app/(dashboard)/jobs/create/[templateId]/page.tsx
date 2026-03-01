"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { DynamicForm } from "@/components/dynamic-form/dynamic-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CreateJobPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const router = useRouter();
  const { data: template } = useSWR(`/api/templates/${templateId}`, fetcher);
  const [loading, setLoading] = useState(false);
  const [jobName, setJobName] = useState("");
  const { t } = useTranslation();

  async function handleSubmit(
    data: Record<string, string>,
    files: Record<string, File>
  ) {
    setLoading(true);
    try {
      // Upload files first
      const assets: { slotId: string; fileName: string; originalName: string; fileUrl: string; fileSize: number; mimeType: string }[] = [];
      for (const [slotId, file] of Object.entries(files)) {
        const presignRes = await fetch("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            action: "upload",
          }),
        });
        const { url, key } = await presignRes.json();

        await fetch(url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        assets.push({
          slotId,
          fileName: file.name,
          originalName: file.name,
          fileUrl: key,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
        });
      }

      // Create job
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          organizationId: template.organizationId,
          jobName: jobName || undefined,
          data,
          assets,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create job");
      }

      const job = await res.json();
      toast.success(t("toast.jobCreated"));
      router.push(`/jobs/${job.id}`);
    } catch {
      toast.error(t("toast.jobCreateFailed"));
    }
    setLoading(false);
  }

  if (!template) {
    return <div>{t("jobs.create.loadingTemplate")}</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("jobs.create.title")}</h1>
        <p className="text-muted-foreground">{t("jobs.create.template")}: {template.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("jobs.create.jobSettings")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="jobName">{t("jobs.create.jobName")}</Label>
            <Input
              id="jobName"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="e.g. Chance Liga - Round 15"
            />
          </div>
        </CardContent>
      </Card>

      <DynamicForm
        variables={template.variables || []}
        footageSlots={template.footageSlots || []}
        onSubmit={handleSubmit}
        loading={loading}
      />
    </div>
  );
}

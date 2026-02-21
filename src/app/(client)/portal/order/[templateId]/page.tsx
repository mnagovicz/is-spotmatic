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

export default function PortalOrderPage() {
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
      const fileUploads: Record<string, string> = {};
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

        fileUploads[slotId] = key;
      }

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          organizationId: template.organizationId,
          jobName: jobName || undefined,
          data: { ...data, ...fileUploads },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create order");
      }

      const job = await res.json();
      toast.success(t("toast.orderCreated"));
      router.push(`/portal/orders/${job.id}`);
    } catch {
      toast.error(t("toast.orderCreateFailed"));
    }
    setLoading(false);
  }

  if (!template) {
    return <div>{t("portal.order.loadingTemplate")}</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("portal.order.title")}</h1>
        <p className="text-muted-foreground">
          {t("portal.order.template")}: {template.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("portal.order.settings")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="jobName">{t("portal.order.jobName")}</Label>
            <Input
              id="jobName"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <DynamicForm
        variables={template.variables || []}
        footageSlots={template.footageSlots || []}
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel={t("portal.order.submit")}
      />
    </div>
  );
}

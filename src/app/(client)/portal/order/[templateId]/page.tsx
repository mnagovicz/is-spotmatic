"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { DynamicForm } from "@/components/dynamic-form/dynamic-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRef, useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { Save, Send } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function PortalOrderPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const router = useRouter();
  const { data: template } = useSWR(`/api/templates/${templateId}`, fetcher);
  const { data: templateDeliveries } = useSWR(
    `/api/templates/${templateId}/deliveries`,
    fetcher
  );
  const [loading, setLoading] = useState(false);
  const [jobName, setJobName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [broadcastDate, setBroadcastDate] = useState("");
  const [deliveryDestinationId, setDeliveryDestinationId] = useState("");
  const [voiceoverVolumeDb, setVoiceoverVolumeDb] = useState<number | undefined>();
  const [backgroundVolumeDb, setBackgroundVolumeDb] = useState<number | undefined>();
  const { t } = useTranslation();
  const draftRef = useRef(false);
  const searchParams = useSearchParams();
  const duplicateJobId = searchParams.get("duplicate");
  const [defaultValues, setDefaultValues] = useState<Record<string, string> | undefined>(undefined);
  const [duplicateLoaded, setDuplicateLoaded] = useState(false);

  useEffect(() => {
    if (!duplicateJobId || duplicateLoaded) return;
    fetch(`/api/jobs/${duplicateJobId}`)
      .then((r) => r.json())
      .then((job) => {
        if (!job || job.error) return;
        // Prefill job name with copy indicator
        if (job.jobName) setJobName(`${job.jobName} (kopie)`);
        // Prefill dates
        if (job.dueDate) setDueDate(job.dueDate.slice(0, 16));
        if (job.broadcastDate) setBroadcastDate(job.broadcastDate.slice(0, 16));
        // Prefill delivery destination
        if (job.deliveryDestinationId) {

          setDeliveryDestinationId(job.deliveryDestinationId);
        }
        // Prefill form fields
        if (job.jobData) {
          const vals: Record<string, string> = {};
          for (const d of job.jobData) {
            vals[d.key] = d.value;
          }
          setDefaultValues(vals);
        }
        // Prefill volumes
        if (job.voiceoverVolumeDb !== undefined && job.voiceoverVolumeDb !== null) setVoiceoverVolumeDb(job.voiceoverVolumeDb);
        if (job.backgroundVolumeDb !== undefined && job.backgroundVolumeDb !== null) setBackgroundVolumeDb(job.backgroundVolumeDb);
        setDuplicateLoaded(true);
      })
      .catch(() => {});
  }, [duplicateJobId, duplicateLoaded]);

  const clientDeliveries = (templateDeliveries || []).filter(
    (td: { clientVisible: boolean; deliveryDestination: { isActive: boolean } }) =>
      td.clientVisible && td.deliveryDestination?.isActive
  );

  async function handleSubmit(
    data: Record<string, string>,
    files: Record<string, File>
  ) {
    const isDraft = draftRef.current;
    setLoading(true);
    try {
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

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          organizationId: template.organizationId,
          jobName: jobName || undefined,
          dueDate: dueDate || undefined,
          broadcastDate: broadcastDate || undefined,
          data,
          assets,
          draft: isDraft,
          deliveryDestinationId: deliveryDestinationId || undefined,
          voiceoverVolumeDb,
          backgroundVolumeDb,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create order");
      }

      const job = await res.json();
      toast.success(isDraft ? t("toast.draftSaved") : t("toast.orderCreated"));
      router.push("/portal/orders");
    } catch {
      toast.error(t("toast.orderCreateFailed"));
    }
    setLoading(false);
  }

  if (!template) {
    return <div>{t("portal.order.loadingTemplate")}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("portal.order.title")}</h1>
        <p className="text-muted-foreground">
          {t("portal.order.template")}: {template.name}
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <Label htmlFor="jobName">{t("portal.order.jobName")}</Label>
          <Input
            id="jobName"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
          />
        </div>
        <div className="flex-1 space-y-2">
          <Label htmlFor="dueDate">{t("portal.order.dueDate")}</Label>
          <Input
            id="dueDate"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="flex-1 space-y-2">
          <Label htmlFor="broadcastDate">{t("portal.order.broadcastDate")}</Label>
          <Input
            id="broadcastDate"
            type="datetime-local"
            value={broadcastDate}
            onChange={(e) => setBroadcastDate(e.target.value)}
          />
        </div>
      </div>

      {clientDeliveries.length > 0 && (
        <div className="space-y-2">
          <Label>{t("deliveries.deliveryDestination")}</Label>
          <Select value={deliveryDestinationId} onValueChange={setDeliveryDestinationId}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder={t("deliveries.selectDestination")} />
            </SelectTrigger>
            <SelectContent>
              {clientDeliveries.map((td: { deliveryDestination: { id: string; name: string }; clientLabel: string | null }) => (
                <SelectItem key={td.deliveryDestination.id} value={td.deliveryDestination.id}>
                  {td.clientLabel || td.deliveryDestination.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(!duplicateJobId || duplicateLoaded) && (
      <DynamicForm
        variables={template.variables || []}
        footageSlots={template.footageSlots || []}
        onSubmit={handleSubmit}
        loading={loading}
        clientMode
        hideSubmitButton
        formId="order-form"
        allowAudioEdit={template.allowClientAudioEdit}
        voiceoverVolumeDb={voiceoverVolumeDb ?? template.voiceoverVolumeDb ?? 0}
        backgroundVolumeDb={backgroundVolumeDb ?? template.backgroundVolumeDb ?? -10}
        onVolumeChange={(vo, bg) => { setVoiceoverVolumeDb(vo); setBackgroundVolumeDb(bg); }}
        defaultValues={defaultValues}
      />
      )}

      <div className="flex gap-3">
        <Button
          type="submit"
          form="order-form"
          variant="outline"
          disabled={loading}
          onClick={() => { draftRef.current = true; }}
        >
          <Save className="mr-2 h-4 w-4" />
          {t("portal.order.saveDraft")}
        </Button>
        <Button
          type="submit"
          form="order-form"
          disabled={loading}
          onClick={() => { draftRef.current = false; }}
        >
          <Send className="mr-2 h-4 w-4" />
          {t("portal.order.submit")}
        </Button>
      </div>
    </div>
  );
}

"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layers, Save, Send } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { DynamicForm } from "@/components/dynamic-form/dynamic-form";
import { useRef, useState } from "react";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Template {
  id: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  color: string | null;
  organizationId: string;
  variables: Array<Record<string, unknown>>;
  footageSlots: Array<Record<string, unknown>>;
}

export default function PortalTemplatesPage() {
  const { data } = useSWR("/api/templates?active=true", fetcher);
  const { t } = useTranslation();
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [jobName, setJobName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [broadcastDate, setBroadcastDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [deliveryDestinationId, setDeliveryDestinationId] = useState("");
  const [voiceoverVolumeDb, setVoiceoverVolumeDb] = useState<number | undefined>();
  const [backgroundVolumeDb, setBackgroundVolumeDb] = useState<number | undefined>();
  const draftRef = useRef(false);

  const templates: Template[] = data?.templates || data || [];
  const selectedTemplate = templates.find((t) => t.id === selectedId);

  // Fetch full template data when selected (includes variables)
  const { data: fullTemplate } = useSWR(
    selectedId ? `/api/templates/${selectedId}` : null,
    fetcher
  );
  const { data: templateDeliveries } = useSWR(
    selectedId ? `/api/templates/${selectedId}/deliveries` : null,
    fetcher
  );

  const clientDeliveries = (templateDeliveries || []).filter(
    (td: { clientVisible: boolean; deliveryDestination: { isActive: boolean } }) =>
      td.clientVisible && td.deliveryDestination?.isActive
  );

  function handleSelect(id: string) {
    setSelectedId(id);
    setJobName("");
    setDueDate("");
    setBroadcastDate("");
    setDeliveryDestinationId("");
    setVoiceoverVolumeDb(undefined);
    setBackgroundVolumeDb(undefined);
  }

  async function handleSubmit(
    formData: Record<string, string>,
    files: Record<string, File>
  ) {
    if (!fullTemplate) return;
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
          templateId: selectedId,
          organizationId: fullTemplate.organizationId,
          jobName: jobName || undefined,
          dueDate: dueDate || undefined,
          broadcastDate: broadcastDate || undefined,
          data: formData,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("portal.templates.title")}</h1>
        <p className="text-muted-foreground">{t("portal.templates.subtitle")}</p>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t("portal.templates.noTemplates")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              className={`flex flex-col cursor-pointer transition-colors ${
                selectedId === template.id
                  ? "ring-2 ring-primary border-primary"
                  : "hover:border-muted-foreground/30"
              }`}
              style={
                template.color
                  ? { borderLeftWidth: 11, borderLeftColor: template.color }
                  : undefined
              }
              onClick={() => handleSelect(template.id)}
            >
              {template.thumbnailUrl && (
                <div className="aspect-video overflow-hidden rounded-t-lg bg-muted">
                  <img
                    src={template.thumbnailUrl}
                    alt={template.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-lg">{template.name}</CardTitle>
              </CardHeader>
              {template.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {template.description}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {selectedId && fullTemplate && (
        <div className="space-y-4">
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

          <DynamicForm
            key={selectedId}
            variables={fullTemplate.variables || []}
            footageSlots={fullTemplate.footageSlots || []}
            onSubmit={handleSubmit}
            loading={loading}
            clientMode
            hideSubmitButton
            formId="order-form"
            allowAudioEdit={fullTemplate.allowClientAudioEdit}
            voiceoverVolumeDb={voiceoverVolumeDb ?? fullTemplate.voiceoverVolumeDb ?? 0}
            backgroundVolumeDb={backgroundVolumeDb ?? fullTemplate.backgroundVolumeDb ?? -10}
            onVolumeChange={(vo, bg) => { setVoiceoverVolumeDb(vo); setBackgroundVolumeDb(bg); }}
          />

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
      )}
    </div>
  );
}

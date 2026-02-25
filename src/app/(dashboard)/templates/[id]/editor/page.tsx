"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Scan,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Send,
  Music,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface AnalysisResult {
  compositions: { name: string }[];
  controllers: {
    layerName: string;
    effects: { name: string; type: string }[];
  }[];
  footageItems: { name: string; folderPath: string }[];
  fonts: string[];
}

interface Variable {
  id?: string;
  _dndId: string;
  layerName: string;
  effectName: string;
  effectType: string;
  type: "SLIDER" | "CHECKBOX" | "TEXT" | "IMAGE" | "SELECT" | "COLOR" | "VOICEOVER";
  label: string;
  groupName: string;
  validation: Record<string, unknown> | null;
  defaultValue: string;
  sortOrder: number;
  row: number;
  lines: number;
  clientVisible: boolean;
  clientLabel: string;
}

interface FootageSlot {
  id?: string;
  _dndId: string;
  footageItemName: string;
  folderPath: string;
  label: string;
  allowedFormats: string[];
  maxFileSize: number;
  sortOrder: number;
  clientVisible: boolean;
  clientLabel: string;
}

interface DeliveryDestination {
  id: string;
  name: string;
  type: "FTP" | "SFTP" | "WEBHOOK";
  isActive: boolean;
}

interface TemplateDeliveryConfig {
  deliveryDestinationId: string;
  clientVisible: boolean;
  clientLabel: string;
  sortOrder: number;
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: Record<string, unknown>) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    position: "relative",
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(listeners ?? {})}
    </div>
  );
}

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: template, mutate: mutateTemplate } = useSWR(
    `/api/templates/${id}`,
    fetcher
  );
  const { t } = useTranslation();

  const [templateName, setTemplateName] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [footageSlots, setFootageSlots] = useState<FootageSlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deliveryConfigs, setDeliveryConfigs] = useState<TemplateDeliveryConfig[]>([]);

  const { data: allDeliveries } = useSWR<DeliveryDestination[]>("/api/deliveries", fetcher);
  const { data: templateDeliveries } = useSWR(
    `/api/templates/${id}/deliveries`,
    fetcher
  );

  const activeDeliveries = allDeliveries?.filter((d) => d.isActive) || [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleVariablesDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setVariables((prev) => {
      const oldIndex = prev.findIndex((v) => v._dndId === String(active.id));
      const newIndex = prev.findIndex((v) => v._dndId === String(over.id));
      const reordered = arrayMove(prev, oldIndex, newIndex);
      return reordered.map((v, i) => ({ ...v, sortOrder: i }));
    });
  }

  function handleFootageDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFootageSlots((prev) => {
      const oldIndex = prev.findIndex((s) => s._dndId === String(active.id));
      const newIndex = prev.findIndex((s) => s._dndId === String(over.id));
      const reordered = arrayMove(prev, oldIndex, newIndex);
      return reordered.map((s, i) => ({ ...s, sortOrder: i }));
    });
  }

  // Initialize from template data
  const [initialized, setInitialized] = useState(false);
  const initFromTemplate = useCallback(() => {
    if (template?.variables) {
      setVariables(
        template.variables.map((v: Variable, i: number) => ({
          ...v,
          _dndId: v.id || crypto.randomUUID(),
          sortOrder: v.sortOrder ?? i,
          row: v.row ?? 0,
          lines: v.lines ?? 1,
          groupName: v.groupName || "",
          defaultValue: v.defaultValue || "",
          validation: v.validation || null,
          clientVisible: v.clientVisible ?? false,
          clientLabel: v.clientLabel || "",
        }))
      );
    }
    if (template?.footageSlots) {
      setFootageSlots(
        template.footageSlots.map((s: FootageSlot, i: number) => ({
          ...s,
          _dndId: s.id || crypto.randomUUID(),
          sortOrder: s.sortOrder ?? i,
          clientVisible: s.clientVisible ?? false,
          clientLabel: s.clientLabel || "",
        }))
      );
    }
    setInitialized(true);
  }, [template]);

  // Initialize delivery configs from loaded data
  const [deliveriesInitialized, setDeliveriesInitialized] = useState(false);
  if (templateDeliveries && Array.isArray(templateDeliveries) && !deliveriesInitialized) {
    setDeliveryConfigs(
      templateDeliveries.map((td: { deliveryDestinationId: string; clientVisible: boolean; clientLabel: string | null; sortOrder: number }) => ({
        deliveryDestinationId: td.deliveryDestinationId,
        clientVisible: td.clientVisible,
        clientLabel: td.clientLabel || "",
        sortOrder: td.sortOrder,
      }))
    );
    setDeliveriesInitialized(true);
  }

  // Load on first render with template data
  if (template && !initialized) {
    initFromTemplate();
  }

  if (template && !templateName) {
    setTemplateName(template.name);
  }

  async function handleUploadAep(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    await fetch(`/api/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aepFileName: file.name,
        aepFileSize: file.size,
      }),
    });

    (window as unknown as Record<string, File>).__aepFile = file;

    setUploading(false);
    mutateTemplate();
    toast.success(t("toast.uploaded", { name: file.name }));
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const file = (window as unknown as Record<string, File>).__aepFile;
      if (!file) {
        toast.error(t("toast.uploadAepFirst"));
        setAnalyzing(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/templates/${id}/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Analysis failed");
      }

      const result = await res.json();
      const analysisData: AnalysisResult = result.analysis ?? result;
      setAnalysis(analysisData);
      toast.success(
        `Found ${analysisData.controllers.length} controllers, ${analysisData.footageItems.length} footage items`
      );
    } catch {
      toast.error(t("toast.analysisFailed"));
    }
    setAnalyzing(false);
  }

  function addVariableFromController(
    layerName: string,
    effect: { name: string; type: string }
  ) {
    const type = effect.type === "Checkbox" ? "CHECKBOX" : "SLIDER";
    setVariables((prev) => [
      ...prev,
      {
        _dndId: crypto.randomUUID(),
        layerName,
        effectName: effect.name,
        effectType: effect.type,
        type,
        label: effect.name,
        groupName: layerName,
        validation: type === "SLIDER" ? { min: 0, max: 100 } : null,
        defaultValue: type === "CHECKBOX" ? "0" : "",
        sortOrder: prev.length,
        row: 0,
        lines: 1,
        clientVisible: false,
        clientLabel: "",
      },
    ]);
  }

  function addFootageSlotFromItem(item: { name: string; folderPath: string }) {
    setFootageSlots((prev) => [
      ...prev,
      {
        _dndId: crypto.randomUUID(),
        footageItemName: item.name,
        folderPath: item.folderPath,
        label: item.name.replace(/\.[^.]+$/, ""),
        allowedFormats: ["png", "jpg", "ai", "psd"],
        maxFileSize: 10485760,
        sortOrder: prev.length,
        clientVisible: false,
        clientLabel: "",
      },
    ]);
  }

  function removeVariable(index: number) {
    setVariables((prev) => prev.filter((_, i) => i !== index));
  }

  function removeFootageSlot(index: number) {
    setFootageSlots((prev) => prev.filter((_, i) => i !== index));
  }

  function updateVariable(index: number, updates: Partial<Variable>) {
    setVariables((prev) =>
      prev.map((v, i) => (i === index ? { ...v, ...updates } : v))
    );
  }

  function updateFootageSlot(index: number, updates: Partial<FootageSlot>) {
    setFootageSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const cleanVariables = variables.map((v) => ({
        layerName: v.layerName,
        effectName: v.effectName,
        effectType: v.effectType,
        type: v.type,
        label: v.label,
        groupName: v.groupName || undefined,
        validation: v.validation,
        defaultValue: v.defaultValue || undefined,
        sortOrder: v.sortOrder,
        row: v.row,
        lines: v.lines,
        clientVisible: v.clientVisible,
        clientLabel: v.clientLabel || undefined,
      }));

      const cleanSlots = footageSlots
        .filter((s) => s.footageItemName && s.label)
        .map((s) => ({
          footageItemName: s.footageItemName,
          folderPath: s.folderPath,
          label: s.label,
          allowedFormats: s.allowedFormats,
          maxFileSize: s.maxFileSize,
          sortOrder: s.sortOrder,
          clientVisible: s.clientVisible,
          clientLabel: s.clientLabel || undefined,
        }));

      console.log("Saving footageSlots state:", footageSlots.map((s) => ({
        footageItemName: s.footageItemName,
        folderPath: s.folderPath,
        label: s.label,
      })));

      const [varRes, slotRes, deliveryRes] = await Promise.all([
        fetch(`/api/templates/${id}/variables`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variables: cleanVariables }),
        }),
        fetch(`/api/templates/${id}/footage-slots`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slots: cleanSlots }),
        }),
        fetch(`/api/templates/${id}/deliveries`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliveries: deliveryConfigs }),
        }),
      ]);

      if (!varRes.ok) {
        const errBody = await varRes.json().catch(() => null);
        console.error("Variables save failed:", varRes.status, errBody);
        throw new Error(`Variables: ${varRes.status} ${JSON.stringify(errBody)}`);
      }
      if (!slotRes.ok) {
        const errBody = await slotRes.json().catch(() => null);
        console.error("Slots save failed:", slotRes.status, errBody);
        throw new Error(`Slots: ${slotRes.status} ${JSON.stringify(errBody)}`);
      }
      if (!deliveryRes.ok) {
        const errBody = await deliveryRes.json().catch(() => null);
        console.error("Delivery save failed:", deliveryRes.status, errBody);
        throw new Error(`Deliveries: ${deliveryRes.status} ${JSON.stringify(errBody)}`);
      }

      toast.success(t("toast.templateSaved"));
      mutateTemplate();
    } catch (err) {
      console.error("Save error:", err);
      toast.error(t("toast.templateSaveFailed"));
    }
    setSaving(false);
  }

  if (!template) {
    return <div>{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="w-1/2 space-y-1">
          <div className="flex items-center gap-3">
            {template.color && (
              <span
                className="h-8 w-8 shrink-0 rounded-full border -translate-y-[3px]"
                style={{ backgroundColor: template.color }}
              />
            )}
            <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onBlur={() => {
              if (templateName && templateName !== template.name) {
                fetch(`/api/templates/${id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: templateName }),
                }).then(() => mutateTemplate());
              }
            }}
            className="w-full bg-transparent text-4xl font-bold tracking-tight outline-none border-b-2 border-dashed border-muted-foreground/25 pb-1 hover:border-muted-foreground/50 focus:border-primary focus:border-solid transition-colors"
          />
          </div>
          <p className="text-sm text-muted-foreground">{t("templates.editor.templateEditor")}</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? t("templates.editor.saving") : t("templates.editor.saveConfig")}
        </Button>
      </div>

      {/* AEP Upload & Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>{t("templates.editor.aepFile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div>
              <Label htmlFor="aepFile">{t("templates.editor.uploadAep")}</Label>
              <Input
                id="aepFile"
                type="file"
                accept=".aep"
                onChange={handleUploadAep}
                disabled={uploading}
              />
            </div>
            {template.aepFileName && (
              <Badge variant="outline">{template.aepFileName}</Badge>
            )}
            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              variant="outline"
            >
              <Scan className="mr-2 h-4 w-4" />
              {analyzing ? t("templates.editor.analyzing") : t("templates.editor.analyzeAep")}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("templates.editor.exportComp")}</Label>
              <Input
                value={template.exportCompName || ""}
                onChange={(e) =>
                  fetch(`/api/templates/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ exportCompName: e.target.value }),
                  }).then(() => mutateTemplate())
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("templates.editor.controlComp")}</Label>
              <Input
                value={template.controlCompName || ""}
                onChange={(e) =>
                  fetch(`/api/templates/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ controlCompName: e.target.value }),
                  }).then(() => mutateTemplate())
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Background Audio */}
      <Card>
        <CardHeader>
          <CardTitle>{t("templates.editor.backgroundAudio")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <Label htmlFor="backgroundAudio">{t("templates.editor.uploadWav")}</Label>
              <Input
                id="backgroundAudio"
                type="file"
                accept=".wav"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const presignRes = await fetch("/api/files", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        fileName: file.name,
                        contentType: file.type || "audio/wav",
                        action: "upload",
                      }),
                    });
                    const { url, key } = await presignRes.json();
                    await fetch(url, {
                      method: "PUT",
                      body: file,
                      headers: { "Content-Type": file.type || "audio/wav" },
                    });
                    await fetch(`/api/templates/${id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        backgroundAudioUrl: key,
                        backgroundAudioName: file.name,
                      }),
                    });
                    mutateTemplate();
                    toast.success(t("toast.wavUploaded"));
                  } catch {
                    toast.error(t("toast.templateSaveFailed"));
                  }
                }}
              />
            </div>
            {template.backgroundAudioName && (
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline">{template.backgroundAudioName}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audio Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("templates.editor.audioSettings")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{t("templates.editor.fps")}</Label>
              <Input
                type="number"
                min={1}
                value={template.fps ?? 25}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val > 0) {
                    fetch(`/api/templates/${id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ fps: val }),
                    }).then(() => mutateTemplate());
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("templates.editor.voiceoverVolume")}</Label>
              <Input
                type="number"
                step={0.5}
                value={template.voiceoverVolumeDb ?? 0}
                onChange={(e) => {
                  fetch(`/api/templates/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ voiceoverVolumeDb: parseFloat(e.target.value) || 0 }),
                  }).then(() => mutateTemplate());
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("templates.editor.backgroundVolume")}</Label>
              <Input
                type="number"
                step={0.5}
                value={template.backgroundVolumeDb ?? -10}
                onChange={(e) => {
                  fetch(`/api/templates/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ backgroundVolumeDb: parseFloat(e.target.value) || 0 }),
                  }).then(() => mutateTemplate());
                }}
              />
            </div>
            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="allowClientAudioEdit"
                  checked={template.allowClientAudioEdit ?? false}
                  onCheckedChange={(checked) => {
                    fetch(`/api/templates/${id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ allowClientAudioEdit: !!checked }),
                    }).then(() => mutateTemplate());
                  }}
                />
                <Label htmlFor="allowClientAudioEdit" className="text-sm">
                  {t("templates.editor.allowClientAudioEdit")}
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>{t("templates.editor.analysisResults")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="controllers">
              <TabsList>
                <TabsTrigger value="controllers">
                  {t("templates.editor.controllers")} ({analysis.controllers.length})
                </TabsTrigger>
                <TabsTrigger value="footage">
                  {t("templates.editor.footage")} ({analysis.footageItems.length})
                </TabsTrigger>
                <TabsTrigger value="compositions">
                  {t("templates.editor.compositions")} ({analysis.compositions.length})
                </TabsTrigger>
                <TabsTrigger value="fonts">
                  {t("templates.editor.fonts")} ({analysis.fonts.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="controllers" className="space-y-4">
                {analysis.controllers.map((ctrl) => (
                  <div key={ctrl.layerName} className="rounded-md border p-4">
                    <h4 className="mb-2 font-medium">{ctrl.layerName}</h4>
                    <div className="space-y-2">
                      {ctrl.effects.map((effect) => {
                        const isAdded = variables.some(
                          (v) =>
                            v.layerName === ctrl.layerName &&
                            v.effectName === effect.name
                        );
                        return (
                          <div
                            key={effect.name}
                            className="flex items-center justify-between rounded bg-muted p-2"
                          >
                            <div>
                              <span className="font-mono text-sm">
                                {effect.name}
                              </span>
                              <Badge variant="outline" className="ml-2">
                                {effect.type}
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant={isAdded ? "secondary" : "default"}
                              disabled={isAdded}
                              onClick={() =>
                                addVariableFromController(
                                  ctrl.layerName,
                                  effect
                                )
                              }
                            >
                              {isAdded ? t("templates.editor.added") : (
                                <>
                                  <Plus className="mr-1 h-3 w-3" /> {t("templates.editor.add")}
                                </>
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="footage" className="space-y-2">
                {analysis.footageItems.map((item) => {
                  const isAdded = footageSlots.some(
                    (s) => s.footageItemName === item.name
                  );
                  return (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="font-mono text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.folderPath}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={isAdded ? "secondary" : "default"}
                        disabled={isAdded}
                        onClick={() => addFootageSlotFromItem(item)}
                      >
                        {isAdded ? t("templates.editor.added") : (
                          <>
                            <Plus className="mr-1 h-3 w-3" /> {t("templates.editor.addSlot")}
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="compositions" className="space-y-2">
                {analysis.compositions.map((comp) => (
                  <div
                    key={comp.name}
                    className="rounded-md border p-3 font-mono text-sm"
                  >
                    {comp.name}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="fonts" className="space-y-2">
                {analysis.fonts.map((font) => (
                  <div
                    key={font}
                    className="rounded-md border p-3 text-sm"
                  >
                    {font}
                  </div>
                ))}
                {analysis.fonts.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground">
                    {t("templates.editor.noFonts")}
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Variable Configuration */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("templates.variables")} ({variables.length})</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setVariables((prev) => [
                ...prev,
                {
                  _dndId: crypto.randomUUID(),
                  layerName: "",
                  effectName: "",
                  effectType: "Slider",
                  type: "SLIDER",
                  label: "",
                  groupName: "",
                  validation: null,
                  defaultValue: "",
                  sortOrder: prev.length,
                  row: 0,
                  lines: 1,
                  clientVisible: false,
                  clientLabel: "",
                },
              ])
            }
          >
            <Plus className="mr-1 h-3 w-3" /> {t("templates.editor.addManual")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleVariablesDragEnd}>
          <SortableContext items={variables.map((v) => v._dndId)} strategy={verticalListSortingStrategy}>
          {variables.map((v, i) => (
            <SortableRow key={v._dndId} id={v._dndId}>
            {(dragHandleProps) => (
            <div className={`rounded-md border p-4 space-y-3 transition-colors ${v.clientVisible ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20" : ""}`}>
              {/* All fields in one row */}
              <div className="flex items-start gap-2">
                <button type="button" className="mt-6 shrink-0 touch-none" style={{ cursor: "grab" }} {...dragHandleProps}>
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </button>
                <div className="grid flex-1 gap-2" style={{ gridTemplateColumns: '2fr 2fr 2fr 1fr 1.5fr 1fr 1fr' }}>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("templates.editor.label")}</Label>
                    <Input
                      value={v.label}
                      onChange={(e) => updateVariable(i, { label: e.target.value })}
                      placeholder="Field label"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("templates.editor.layerName")}</Label>
                    <Input
                      value={v.layerName}
                      onChange={(e) =>
                        updateVariable(i, { layerName: e.target.value })
                      }
                      placeholder="controler hoste"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("templates.editor.effectName")}</Label>
                    <Input
                      value={v.effectName}
                      onChange={(e) =>
                        updateVariable(i, { effectName: e.target.value })
                      }
                      placeholder="kurz hoste"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("templates.editor.type")}</Label>
                    <Select
                      value={v.type}
                      onValueChange={(val) =>
                        updateVariable(i, {
                          type: val as Variable["type"],
                          effectType:
                            val === "CHECKBOX"
                              ? "Checkbox"
                              : val === "SLIDER"
                              ? "Slider"
                              : v.effectType,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SLIDER">Slider</SelectItem>
                        <SelectItem value="CHECKBOX">Checkbox</SelectItem>
                        <SelectItem value="TEXT">Text</SelectItem>
                        <SelectItem value="COLOR">Color</SelectItem>
                        <SelectItem value="SELECT">Select</SelectItem>
                        <SelectItem value="VOICEOVER">Voiceover</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("templates.editor.group")}</Label>
                    <Input
                      value={v.groupName}
                      onChange={(e) =>
                        updateVariable(i, { groupName: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("templates.editor.defaultValue")}</Label>
                    <Input
                      value={v.defaultValue}
                      onChange={(e) =>
                        updateVariable(i, { defaultValue: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("templates.editor.effectType")}</Label>
                    <Input
                      value={v.effectType}
                      onChange={(e) =>
                        updateVariable(i, { effectType: e.target.value })
                      }
                    />
                  </div>
                  {v.type === "TEXT" && (
                    <div className="space-y-1">
                      <Label className="text-xs">{t("templates.editor.maxChars")}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={(v.validation as Record<string, number> | null)?.maxChars ?? ""}
                        onChange={(e) =>
                          updateVariable(i, {
                            validation: {
                              ...((v.validation as Record<string, unknown>) || {}),
                              maxChars: parseInt(e.target.value) || undefined,
                            },
                          })
                        }
                        placeholder="-"
                      />
                    </div>
                  )}
                  {v.type === "VOICEOVER" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("templates.editor.charsPerSecond")}</Label>
                        <Input
                          type="number"
                          min={1}
                          value={(v.validation as Record<string, number> | null)?.charsPerSecond ?? 15}
                          onChange={(e) =>
                            updateVariable(i, {
                              validation: {
                                ...((v.validation as Record<string, unknown>) || {}),
                                charsPerSecond: parseInt(e.target.value) || 15,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("templates.editor.maxDuration")}</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.1}
                          value={(v.validation as Record<string, number> | null)?.maxDuration ?? ""}
                          onChange={(e) =>
                            updateVariable(i, {
                              validation: {
                                ...((v.validation as Record<string, unknown>) || {}),
                                maxDuration: parseFloat(e.target.value) || undefined,
                              },
                            })
                          }
                          placeholder="-"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("templates.editor.startFrame")}</Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={(v.validation as Record<string, number> | null)?.startFrame ?? ""}
                          onChange={(e) =>
                            updateVariable(i, {
                              validation: {
                                ...((v.validation as Record<string, unknown>) || {}),
                                startFrame: parseInt(e.target.value) || undefined,
                              },
                            })
                          }
                          placeholder={t("templates.editor.startFrameHint")}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("templates.editor.voiceId")}</Label>
                        <Input
                          value={(v.validation as Record<string, string> | null)?.voiceId ?? ""}
                          onChange={(e) =>
                            updateVariable(i, {
                              validation: {
                                ...((v.validation as Record<string, unknown>) || {}),
                                voiceId: e.target.value || undefined,
                              },
                            })
                          }
                          placeholder="ElevenLabs Voice ID"
                        />
                      </div>
                    </>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 mt-5"
                  onClick={() => removeVariable(i)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>

              {/* Client visibility */}
              <div className="border-t pt-3 pl-7">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 shrink-0">
                    <Checkbox
                      id={`clientVisible-${i}`}
                      checked={v.clientVisible}
                      onCheckedChange={(checked) =>
                        updateVariable(i, { clientVisible: !!checked })
                      }
                    />
                    <Label htmlFor={`clientVisible-${i}`} className="text-xs font-normal">
                      {t("templates.editor.clientVisible")}
                    </Label>
                  </div>
                  {v.clientVisible && (
                    <>
                      <div className="flex items-center gap-2 flex-1 max-w-sm">
                        <Label className="text-xs whitespace-nowrap shrink-0">{t("templates.editor.clientLabel")}</Label>
                        <Input
                          value={v.clientLabel}
                          onChange={(e) =>
                            updateVariable(i, { clientLabel: e.target.value })
                          }
                          placeholder={t("templates.editor.clientLabelHint")}
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Label className="text-xs whitespace-nowrap">{t("templates.editor.row")}</Label>
                        <Input
                          type="number"
                          min={0}
                          value={v.row}
                          onChange={(e) =>
                            updateVariable(i, { row: parseInt(e.target.value) || 0 })
                          }
                          className="w-16 h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Label className="text-xs whitespace-nowrap">{t("templates.editor.lines")}</Label>
                        <Input
                          type="number"
                          min={1}
                          value={v.lines}
                          onChange={(e) =>
                            updateVariable(i, { lines: parseInt(e.target.value) || 1 })
                          }
                          className="w-16 h-8 text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            )}
            </SortableRow>
          ))}
          </SortableContext>
          </DndContext>
          {variables.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              {t("templates.editor.noVariables")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Footage Slots */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("templates.editor.footageSlots")} ({footageSlots.length})</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setFootageSlots((prev) => [
                ...prev,
                {
                  _dndId: crypto.randomUUID(),
                  footageItemName: "",
                  folderPath: "",
                  label: "",
                  allowedFormats: ["png", "jpg", "ai", "psd"],
                  maxFileSize: 10485760,
                  sortOrder: prev.length,
                  clientVisible: false,
                  clientLabel: "",
                },
              ])
            }
          >
            <Plus className="mr-1 h-3 w-3" /> {t("templates.editor.addSlot")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFootageDragEnd}>
          <SortableContext items={footageSlots.map((s) => s._dndId)} strategy={verticalListSortingStrategy}>
          {footageSlots.map((s, i) => (
            <SortableRow key={s._dndId} id={s._dndId}>
            {(dragHandleProps) => (
            <div className={`rounded-md border p-4 space-y-3 ${s.clientVisible ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20" : ""}`}>
              <div className="flex items-start gap-3">
                <button type="button" className="mt-2 shrink-0 touch-none" style={{ cursor: "grab" }} {...dragHandleProps}>
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </button>
                <div className="grid flex-1 gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("templates.editor.label")}</Label>
                    <Input
                      value={s.label}
                      onChange={(e) =>
                        updateFootageSlot(i, { label: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("templates.editor.footageItemName")}</Label>
                    <Input
                      value={s.footageItemName}
                      onChange={(e) =>
                        updateFootageSlot(i, { footageItemName: e.target.value })
                      }
                      placeholder="FK Pardubice-logo.png"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("templates.editor.folderPath")}</Label>
                    <Input
                      value={s.folderPath}
                      onChange={(e) =>
                        updateFootageSlot(i, { folderPath: e.target.value })
                      }
                      placeholder="PODKLADY_CHL/LOGA/"
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFootageSlot(i)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
              <Separator />
              <div className="flex items-center gap-4 px-8">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`slot-visible-${i}`}
                    checked={s.clientVisible}
                    onCheckedChange={(checked) =>
                      updateFootageSlot(i, { clientVisible: !!checked })
                    }
                  />
                  <Label htmlFor={`slot-visible-${i}`} className="text-sm">
                    {t("templates.editor.clientVisible")}
                  </Label>
                </div>
                {s.clientVisible && (
                  <Input
                    value={s.clientLabel}
                    onChange={(e) =>
                      updateFootageSlot(i, { clientLabel: e.target.value })
                    }
                    placeholder={t("templates.editor.clientLabel")}
                    className="max-w-xs h-8 text-sm"
                  />
                )}
              </div>
            </div>
            )}
            </SortableRow>
          ))}
          </SortableContext>
          </DndContext>
          {footageSlots.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              {t("templates.editor.noFootageSlots")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Delivery Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {t("templates.editor.delivery")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("templates.editor.deliveryDesc")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeDeliveries.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              {t("templates.editor.noActiveDeliveries")}
            </p>
          ) : (
            activeDeliveries.map((dest) => {
              const configIndex = deliveryConfigs.findIndex(
                (c) => c.deliveryDestinationId === dest.id
              );
              const isAssigned = configIndex >= 0;
              const config = isAssigned ? deliveryConfigs[configIndex] : null;

              return (
                <div
                  key={dest.id}
                  className={`rounded-md border p-4 space-y-3 transition-colors ${
                    isAssigned ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20" : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Checkbox
                      id={`delivery-${dest.id}`}
                      checked={isAssigned}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setDeliveryConfigs((prev) => [
                            ...prev,
                            {
                              deliveryDestinationId: dest.id,
                              clientVisible: false,
                              clientLabel: "",
                              sortOrder: prev.length,
                            },
                          ]);
                        } else {
                          setDeliveryConfigs((prev) =>
                            prev.filter((c) => c.deliveryDestinationId !== dest.id)
                          );
                        }
                      }}
                    />
                    <Label htmlFor={`delivery-${dest.id}`} className="flex-1 cursor-pointer">
                      <span className="font-medium">{dest.name}</span>
                      <Badge variant="outline" className="ml-2">{dest.type}</Badge>
                    </Label>
                  </div>

                  {isAssigned && config && (
                    <div className="border-t pt-3 pl-7">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 shrink-0">
                          <Checkbox
                            id={`delivery-visible-${dest.id}`}
                            checked={config.clientVisible}
                            onCheckedChange={(checked) => {
                              setDeliveryConfigs((prev) =>
                                prev.map((c) =>
                                  c.deliveryDestinationId === dest.id
                                    ? { ...c, clientVisible: !!checked }
                                    : c
                                )
                              );
                            }}
                          />
                          <Label htmlFor={`delivery-visible-${dest.id}`} className="text-xs font-normal">
                            {t("templates.editor.clientVisible")}
                          </Label>
                        </div>
                        {config.clientVisible && (
                          <div className="flex items-center gap-2 flex-1 max-w-sm">
                            <Label className="text-xs whitespace-nowrap shrink-0">
                              {t("templates.editor.clientLabel")}
                            </Label>
                            <Input
                              value={config.clientLabel}
                              onChange={(e) => {
                                setDeliveryConfigs((prev) =>
                                  prev.map((c) =>
                                    c.deliveryDestinationId === dest.id
                                      ? { ...c, clientLabel: e.target.value }
                                      : c
                                  )
                                );
                              }}
                              placeholder={t("templates.editor.clientLabelHint")}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

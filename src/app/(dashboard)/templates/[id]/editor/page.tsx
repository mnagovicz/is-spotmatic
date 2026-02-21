"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Upload,
  Scan,
  Save,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

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
  layerName: string;
  effectName: string;
  effectType: string;
  type: "SLIDER" | "CHECKBOX" | "TEXT" | "IMAGE" | "SELECT" | "COLOR";
  label: string;
  groupName: string;
  validation: Record<string, unknown> | null;
  defaultValue: string;
  sortOrder: number;
}

interface FootageSlot {
  id?: string;
  footageItemName: string;
  folderPath: string;
  label: string;
  allowedFormats: string[];
  maxFileSize: number;
  sortOrder: number;
}

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: template, mutate: mutateTemplate } = useSWR(
    `/api/templates/${id}`,
    fetcher
  );
  const { t } = useTranslation();

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [footageSlots, setFootageSlots] = useState<FootageSlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Initialize from template data
  const initFromTemplate = useCallback(() => {
    if (template?.variables) {
      setVariables(
        template.variables.map((v: Variable, i: number) => ({
          ...v,
          sortOrder: v.sortOrder ?? i,
          groupName: v.groupName || "",
          defaultValue: v.defaultValue || "",
          validation: v.validation || null,
        }))
      );
    }
    if (template?.footageSlots) {
      setFootageSlots(
        template.footageSlots.map((s: FootageSlot, i: number) => ({
          ...s,
          sortOrder: s.sortOrder ?? i,
        }))
      );
    }
  }, [template]);

  // Load on first render with template data
  if (template && variables.length === 0 && template.variables?.length > 0) {
    initFromTemplate();
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
        layerName,
        effectName: effect.name,
        effectType: effect.type,
        type,
        label: effect.name,
        groupName: layerName,
        validation: type === "SLIDER" ? { min: 0, max: 100 } : null,
        defaultValue: type === "CHECKBOX" ? "0" : "",
        sortOrder: prev.length,
      },
    ]);
  }

  function addFootageSlotFromItem(item: { name: string; folderPath: string }) {
    setFootageSlots((prev) => [
      ...prev,
      {
        footageItemName: item.name,
        folderPath: item.folderPath,
        label: item.name.replace(/\.[^.]+$/, ""),
        allowedFormats: ["png", "jpg", "ai", "psd"],
        maxFileSize: 10485760,
        sortOrder: prev.length,
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
      await Promise.all([
        fetch(`/api/templates/${id}/variables`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variables }),
        }),
        fetch(`/api/templates/${id}/footage-slots`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slots: footageSlots }),
        }),
      ]);
      toast.success(t("toast.templateSaved"));
      mutateTemplate();
    } catch {
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
        <div>
          <h1 className="text-2xl font-bold">{template.name}</h1>
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
                  layerName: "",
                  effectName: "",
                  effectType: "Slider",
                  type: "SLIDER",
                  label: "",
                  groupName: "",
                  validation: null,
                  defaultValue: "",
                  sortOrder: prev.length,
                },
              ])
            }
          >
            <Plus className="mr-1 h-3 w-3" /> {t("templates.editor.addManual")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {variables.map((v, i) => (
            <div key={i} className="flex items-start gap-3 rounded-md border p-4">
              <GripVertical className="mt-2 h-5 w-5 text-muted-foreground" />
              <div className="grid flex-1 gap-3 md:grid-cols-4">
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
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeVariable(i)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
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
                  footageItemName: "",
                  folderPath: "",
                  label: "",
                  allowedFormats: ["png", "jpg", "ai", "psd"],
                  maxFileSize: 10485760,
                  sortOrder: prev.length,
                },
              ])
            }
          >
            <Plus className="mr-1 h-3 w-3" /> {t("templates.editor.addSlot")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {footageSlots.map((s, i) => (
            <div key={i} className="flex items-start gap-3 rounded-md border p-4">
              <Upload className="mt-2 h-5 w-5 text-muted-foreground" />
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
          ))}
          {footageSlots.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              {t("templates.editor.noFootageSlots")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

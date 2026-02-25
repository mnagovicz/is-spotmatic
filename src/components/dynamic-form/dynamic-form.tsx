"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/lib/i18n";
import { Play, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TemplateVariable {
  id: string;
  layerName: string;
  effectName: string;
  effectType: string;
  type: "SLIDER" | "CHECKBOX" | "TEXT" | "IMAGE" | "SELECT" | "COLOR" | "VOICEOVER";
  label: string;
  groupName: string | null;
  validation: { min?: number; max?: number; step?: number; voiceId?: string; charsPerSecond?: number; maxDuration?: number; startFrame?: number } | null;
  defaultValue: string | null;
  sortOrder: number;
  row?: number;
  lines?: number;
  clientVisible?: boolean;
  clientLabel?: string | null;
}

interface FootageSlot {
  id: string;
  footageItemName: string;
  folderPath: string;
  label: string;
  allowedFormats: string[];
  maxFileSize: number;
  clientVisible?: boolean;
  clientLabel?: string | null;
}

interface DynamicFormProps {
  variables: TemplateVariable[];
  footageSlots: FootageSlot[];
  onSubmit: (data: Record<string, string>, files: Record<string, File>) => void;
  loading?: boolean;
  submitLabel?: string;
  clientMode?: boolean;
  hideSubmitButton?: boolean;
  defaultValues?: Record<string, string>;
  formId?: string;
  allowAudioEdit?: boolean;
  voiceoverVolumeDb?: number;
  backgroundVolumeDb?: number;
  onVolumeChange?: (voiceoverVolumeDb: number, backgroundVolumeDb: number) => void;
}

export function DynamicForm({
  variables,
  footageSlots,
  onSubmit,
  loading,
  submitLabel,
  clientMode,
  hideSubmitButton,
  defaultValues,
  formId,
  allowAudioEdit,
  voiceoverVolumeDb,
  backgroundVolumeDb,
  onVolumeChange,
}: DynamicFormProps) {
  const displayVariables = clientMode
    ? variables.filter((v) => v.clientVisible)
    : variables;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    variables.forEach((v) => {
      defaults[v.id] = defaultValues?.[v.id] ?? v.defaultValue ?? (v.type === "CHECKBOX" ? "0" : "");
    });
    return defaults;
  });

  const [files, setFiles] = useState<Record<string, File>>({});
  const { t } = useTranslation();

  // Voiceover preview state
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setPlayingId(null);
  }, []);

  const playPreview = useCallback(async (variableId: string, text: string, voiceId: string) => {
    stopPreview();
    setPreviewLoading(variableId);
    try {
      const res = await fetch("/api/tts/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPlayingId(null);
        audioRef.current = null;
      };
      await audio.play();
      setPlayingId(variableId);
    } catch {
      toast.error(t("toast.ttsPreviewFailed"));
    }
    setPreviewLoading(null);
  }, [stopPreview, t]);

  function updateValue(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function handleFileChange(slotId: string, file: File | undefined) {
    if (file) {
      setFiles((prev) => ({ ...prev, [slotId]: file }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values, files);
  }

  // Group variables by groupName
  const groups = displayVariables.reduce(
    (acc, v) => {
      const group = v.groupName || t("form.general");
      if (!acc[group]) acc[group] = [];
      acc[group].push(v);
      return acc;
    },
    {} as Record<string, TemplateVariable[]>
  );

  function renderVariable(v: TemplateVariable) {
    const compact = clientMode;
    return (
      <div key={v.id} className={compact ? "space-y-1" : "space-y-2"}>
        <Label htmlFor={v.id} className={compact ? "text-xs font-medium text-muted-foreground" : ""}>
          {clientMode ? (v.clientLabel || v.label) : v.label}
        </Label>

        {v.type === "SLIDER" && (
          <Input
            id={v.id}
            type="number"
            value={values[v.id] ?? ""}
            onChange={(e) => updateValue(v.id, e.target.value)}
            step={v.validation?.step ?? 0.01}
            min={v.validation?.min}
            max={v.validation?.max}
            className={compact ? "h-9" : ""}
          />
        )}

        {v.type === "CHECKBOX" && (
          <div className="flex items-center gap-2">
            <Checkbox
              id={v.id}
              checked={values[v.id] === "1"}
              onCheckedChange={(checked) =>
                updateValue(v.id, checked ? "1" : "0")
              }
            />
            <Label htmlFor={v.id} className="text-sm font-normal">
              {t("form.enable")}
            </Label>
          </div>
        )}

        {(v.type === "TEXT" || v.type === "VOICEOVER") && (
          <>
            {v.lines && v.lines > 1 ? (
              <Textarea
                id={v.id}
                value={values[v.id] ?? ""}
                onChange={(e) => updateValue(v.id, e.target.value)}
                rows={v.lines}
                className={compact ? "resize-none" : ""}
              />
            ) : (
              <Input
                id={v.id}
                value={values[v.id] ?? ""}
                onChange={(e) => updateValue(v.id, e.target.value)}
                className={compact ? "h-9" : ""}
              />
            )}
            {v.type === "TEXT" && values[v.id]?.length > 0 && (() => {
              const maxChars = (v.validation as Record<string, number> | null)?.maxChars;
              if (maxChars == null || maxChars <= 0) return null;
              const len = values[v.id]?.length || 0;
              const over = len > maxChars;
              return (
                <p className={`text-xs ${over ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                  {len}/{maxChars} {t("form.chars")}{over ? ` — ${t("form.textTooLong")}` : ""}
                </p>
              );
            })()}
            {v.type === "VOICEOVER" && values[v.id]?.length > 0 && (() => {
              const cps = (v.validation as Record<string, number> | null)?.charsPerSecond || 15;
              const maxDur = (v.validation as Record<string, number> | null)?.maxDuration;
              const duration = (values[v.id]?.length || 0) / cps;
              const over = maxDur != null && maxDur > 0 && duration > maxDur;
              return (
                <p className={`text-xs ${over ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                  {t("form.estimatedDuration")}: ~{duration.toFixed(1)} s{over ? ` — ${t("form.voiceoverTooLong")}` : ""}
                </p>
              );
            })()}
            {v.type === "VOICEOVER" && v.validation?.voiceId && (
              <div className="flex gap-2">
                {playingId === v.id ? (
                  <Button type="button" size="sm" variant="outline" onClick={stopPreview}>
                    <Square className="mr-1 h-3 w-3" /> {t("form.stopPreview")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!values[v.id]?.trim() || previewLoading === v.id}
                    onClick={() => playPreview(v.id, values[v.id], v.validation!.voiceId!)}
                  >
                    {previewLoading === v.id ? (
                      <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> {t("form.generatingPreview")}</>
                    ) : (
                      <><Play className="mr-1 h-3 w-3" /> {t("form.previewVoiceover")}</>
                    )}
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {v.type === "COLOR" && (
          <Input
            id={v.id}
            type="color"
            value={values[v.id] || "#000000"}
            onChange={(e) => updateValue(v.id, e.target.value)}
            className={compact ? "h-9" : ""}
          />
        )}

        {!clientMode && (
          <p className="text-xs text-muted-foreground">
            {v.layerName} &rarr; {v.effectName} [{v.effectType}]
          </p>
        )}
      </div>
    );
  }

  const displaySlots = clientMode
    ? footageSlots.filter((s) => s.clientVisible)
    : footageSlots;

  return (
    <form id={formId} onSubmit={handleSubmit} className={clientMode ? "space-y-4" : "space-y-6"}>
      {clientMode ? (
        <Card>
          <CardContent className="space-y-3 pt-5 pb-5">
            {Object.entries(
              displayVariables.reduce(
                (acc, v) => {
                  const r = v.row ?? 0;
                  if (!acc[r]) acc[r] = [];
                  acc[r].push(v);
                  return acc;
                },
                {} as Record<number, TemplateVariable[]>
              )
            )
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([rowNum, vars]) => (
                <div
                  key={rowNum}
                  className="grid gap-3"
                  style={{ gridTemplateColumns: `repeat(${vars.length}, minmax(0, 1fr))` }}
                >
                  {vars.map((v) => renderVariable(v))}
                </div>
              ))}

            {displaySlots.length > 0 && (
              <>
                <Separator className="my-1" />
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(displaySlots.length, 3)}, minmax(0, 1fr))` }}>
                  {displaySlots.map((slot) => (
                    <div key={slot.id} className="space-y-1">
                      <Label htmlFor={`file-${slot.id}`} className="text-xs font-medium text-muted-foreground">
                        {slot.clientLabel || slot.label}
                      </Label>
                      <Input
                        id={`file-${slot.id}`}
                        type="file"
                        accept={slot.allowedFormats
                          .map((f) => `.${f}`)
                          .join(",")}
                        onChange={(e) =>
                          handleFileChange(slot.id, e.target.files?.[0])
                        }
                        className="h-9"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {Object.entries(groups).map(([groupName, vars]) => (
            <Card key={groupName}>
              <CardHeader>
                <CardTitle className="text-lg">{groupName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {vars.map((v) => renderVariable(v))}
              </CardContent>
            </Card>
          ))}

          {displaySlots.length > 0 && (
            <>
              <Separator />
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("form.images")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {displaySlots.map((slot) => (
                    <div key={slot.id} className="space-y-2">
                      <Label htmlFor={`file-${slot.id}`}>
                        {slot.clientLabel || slot.label}
                      </Label>
                      <Input
                        id={`file-${slot.id}`}
                        type="file"
                        accept={slot.allowedFormats
                          .map((f) => `.${f}`)
                          .join(",")}
                        onChange={(e) =>
                          handleFileChange(slot.id, e.target.files?.[0])
                        }
                      />
                      {!clientMode && (
                        <p className="text-xs text-muted-foreground">
                          {t("form.replaces")}: {slot.footageItemName} ({slot.folderPath})
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {allowAudioEdit && onVolumeChange && (
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">{t("form.voiceoverVolume")} (dB)</Label>
                <Input
                  type="number"
                  step={0.5}
                  value={voiceoverVolumeDb ?? 0}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value) || 0, backgroundVolumeDb ?? -10)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">{t("form.backgroundVolume")} (dB)</Label>
                <Input
                  type="number"
                  step={0.5}
                  value={backgroundVolumeDb ?? -10}
                  onChange={(e) => onVolumeChange(voiceoverVolumeDb ?? 0, parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!hideSubmitButton && (
        <Button type="submit" disabled={loading} className={clientMode ? "w-full" : "w-full"} size={clientMode ? "default" : "lg"}>
          {loading ? t("form.submitting") : (submitLabel || t("form.submitRenderJob"))}
        </Button>
      )}
    </form>
  );
}

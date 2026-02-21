"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/lib/i18n";

interface TemplateVariable {
  id: string;
  layerName: string;
  effectName: string;
  effectType: string;
  type: "SLIDER" | "CHECKBOX" | "TEXT" | "IMAGE" | "SELECT" | "COLOR";
  label: string;
  groupName: string | null;
  validation: { min?: number; max?: number; step?: number } | null;
  defaultValue: string | null;
  sortOrder: number;
}

interface FootageSlot {
  id: string;
  footageItemName: string;
  folderPath: string;
  label: string;
  allowedFormats: string[];
  maxFileSize: number;
}

interface DynamicFormProps {
  variables: TemplateVariable[];
  footageSlots: FootageSlot[];
  onSubmit: (data: Record<string, string>, files: Record<string, File>) => void;
  loading?: boolean;
  submitLabel?: string;
}

export function DynamicForm({
  variables,
  footageSlots,
  onSubmit,
  loading,
  submitLabel,
}: DynamicFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    variables.forEach((v) => {
      defaults[v.id] = v.defaultValue || (v.type === "CHECKBOX" ? "0" : "");
    });
    return defaults;
  });

  const [files, setFiles] = useState<Record<string, File>>({});
  const { t } = useTranslation();

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
  const groups = variables.reduce(
    (acc, v) => {
      const group = v.groupName || t("form.general");
      if (!acc[group]) acc[group] = [];
      acc[group].push(v);
      return acc;
    },
    {} as Record<string, TemplateVariable[]>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {Object.entries(groups).map(([groupName, vars]) => (
        <Card key={groupName}>
          <CardHeader>
            <CardTitle className="text-lg">{groupName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {vars.map((v) => (
              <div key={v.id} className="space-y-2">
                <Label htmlFor={v.id}>{v.label}</Label>

                {v.type === "SLIDER" && (
                  <div className="flex items-center gap-4">
                    <Slider
                      id={v.id}
                      min={v.validation?.min ?? 0}
                      max={v.validation?.max ?? 100}
                      step={v.validation?.step ?? 0.01}
                      value={[parseFloat(values[v.id]) || 0]}
                      onValueChange={([val]) =>
                        updateValue(v.id, val.toString())
                      }
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={values[v.id]}
                      onChange={(e) => updateValue(v.id, e.target.value)}
                      step={v.validation?.step ?? 0.01}
                      min={v.validation?.min}
                      max={v.validation?.max}
                      className="w-24"
                    />
                  </div>
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

                {v.type === "TEXT" && (
                  <Input
                    id={v.id}
                    value={values[v.id]}
                    onChange={(e) => updateValue(v.id, e.target.value)}
                  />
                )}

                {v.type === "COLOR" && (
                  <Input
                    id={v.id}
                    type="color"
                    value={values[v.id] || "#000000"}
                    onChange={(e) => updateValue(v.id, e.target.value)}
                  />
                )}

                <p className="text-xs text-muted-foreground">
                  {v.layerName} &rarr; {v.effectName} [{v.effectType}]
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {footageSlots.length > 0 && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("form.images")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {footageSlots.map((slot) => (
                <div key={slot.id} className="space-y-2">
                  <Label htmlFor={`file-${slot.id}`}>{slot.label}</Label>
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
                  <p className="text-xs text-muted-foreground">
                    {t("form.replaces")}: {slot.footageItemName} ({slot.folderPath})
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <Button type="submit" disabled={loading} className="w-full" size="lg">
        {loading ? t("form.submitting") : (submitLabel || t("form.submitRenderJob"))}
      </Button>
    </form>
  );
}

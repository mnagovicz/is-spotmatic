"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Palette, Plus, Settings, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function TemplatesPage() {
  const { data: templates, mutate } = useSWR("/api/templates", fetcher);
  const { data: orgs } = useSWR("/api/organizations", fetcher);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        description: formData.get("description"),
        organizationId: formData.get("organizationId"),
        exportCompName: formData.get("exportCompName") || undefined,
      }),
    });

    setLoading(false);
    setOpen(false);
    mutate();
  }

  async function handleColorChange(id: string, color: string) {
    await fetch(`/api/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
    mutate();
  }

  async function handleDelete(id: string, jobCount: number) {
    if (jobCount > 0) {
      if (!confirm(t("templates.deleteWithJobsConfirm", { count: String(jobCount) }))) return;
    } else {
      if (!confirm(t("templates.deleteConfirm"))) return;
    }
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("templates.title")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> {t("templates.newTemplate")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("templates.createTemplate")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("templates.name")}</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t("templates.description")}</Label>
                <Textarea id="description" name="description" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organizationId">{t("templates.organization")}</Label>
                <Select name="organizationId" required>
                  <SelectTrigger>
                    <SelectValue placeholder={t("templates.selectOrg")} />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs?.map((org: { id: string; name: string }) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exportCompName">{t("templates.exportComp")}</Label>
                <Input
                  id="exportCompName"
                  name="exportCompName"
                  placeholder="___Fotbal_Chance_export"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? t("templates.creating") : t("templates.createTemplate")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("templates.allTemplates")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("templates.name")}</TableHead>
                <TableHead>{t("templates.organization")}</TableHead>
                <TableHead>{t("templates.variables")}</TableHead>
                <TableHead>{t("templates.footage")}</TableHead>
                <TableHead>{t("templates.jobs")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates?.map(
                (tmpl: {
                  id: string;
                  name: string;
                  color: string | null;
                  isActive: boolean;
                  organization: { name: string };
                  _count: { variables: number; footageSlots: number; renderJobs: number };
                }) => (
                  <TableRow key={tmpl.id}>
                    <TableCell className="font-medium">{tmpl.name}</TableCell>
                    <TableCell>{tmpl.organization.name}</TableCell>
                    <TableCell>{tmpl._count.variables}</TableCell>
                    <TableCell>{tmpl._count.footageSlots}</TableCell>
                    <TableCell>{tmpl._count.renderJobs}</TableCell>
                    <TableCell>
                      <Badge variant={tmpl.isActive ? "default" : "secondary"}>
                        {tmpl.isActive ? t("templates.active") : t("templates.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div
                          className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border hover:bg-accent"
                          title={t("templates.color")}
                        >
                          <input
                            type="color"
                            defaultValue={tmpl.color || "#888888"}
                            className="absolute inset-0 cursor-pointer opacity-0"
                            ref={(el) => {
                              if (!el) return;
                              el.onchange = () =>
                                handleColorChange(tmpl.id, el.value);
                            }}
                          />
                          {tmpl.color ? (
                            <span
                              className="pointer-events-none h-4 w-4 rounded-full border"
                              style={{ backgroundColor: tmpl.color }}
                            />
                          ) : (
                            <Palette className="pointer-events-none h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <Link href={`/templates/${tmpl.id}/editor`}>
                          <Button variant="outline" size="sm">
                            <Settings className="mr-1 h-3 w-3" /> {t("templates.editor")}
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(tmpl.id, tmpl._count.renderJobs)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
              {(!templates || templates.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t("templates.noTemplates")}
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

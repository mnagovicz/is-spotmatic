"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
});

interface DeliveryDestination {
  id: string;
  name: string;
  type: "FTP" | "SFTP" | "WEBHOOK";
  host: string | null;
  port: number | null;
  isActive: boolean;
  _count: { templates: number };
}

export default function DeliveriesPage() {
  const { data: destinations, mutate } = useSWR<DeliveryDestination[]>("/api/deliveries", fetcher);
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"FTP" | "SFTP" | "WEBHOOK">("FTP");

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("toast.deliveryCreated"));
      setOpen(false);
      setName("");
      setType("FTP");
      mutate();
    } catch {
      toast.error(t("toast.deliveryCreateFailed"));
    }
    setCreating(false);
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/deliveries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("toast.deliveryDeleted"));
      mutate();
    } catch {
      toast.error(t("toast.deliveryDeleteFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("deliveries.title")}</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("deliveries.new")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("deliveries.new")}</DialogTitle>
              <DialogDescription>{t("deliveries.newDesc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("common.name")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="FTP Nova"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("deliveries.type")}</Label>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FTP">FTP</SelectItem>
                    <SelectItem value="SFTP">SFTP</SelectItem>
                    <SelectItem value="WEBHOOK">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!name || creating}>
                {creating ? t("common.loading") : t("common.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("deliveries.type")}</TableHead>
                <TableHead>{t("deliveries.host")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("deliveries.templates")}</TableHead>
                <TableHead className="w-[100px]">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {destinations?.map((dest) => (
                <TableRow
                  key={dest.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/deliveries/${dest.id}`)}
                >
                  <TableCell className="font-medium">{dest.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{dest.type}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dest.host ? `${dest.host}${dest.port ? `:${dest.port}` : ""}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={dest.isActive ? "default" : "secondary"}>
                      {dest.isActive ? t("deliveries.active") : t("deliveries.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>{dest._count.templates}</TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/deliveries/${dest.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("deliveries.deleteConfirm")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("deliveries.deleteDesc")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(dest.id)}>
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {destinations?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Send className="mx-auto mb-2 h-8 w-8" />
                    {t("deliveries.noDeliveries")}
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

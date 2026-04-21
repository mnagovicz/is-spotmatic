"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Server, Plus, Trash2, Copy, Check, Pencil, Eye, EyeOff, RefreshCw, WifiOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Agent {
  id: string;
  name: string;
  hostname: string | null;
  apiKey: string;
  status: string;
  lastHeartbeat: string | null;
  currentJobId: string | null;
}

export default function AgentsPage() {
  const { data: agents, mutate } = useSWR<Agent[]>("/api/agents", fetcher, {
    refreshInterval: 10000,
  });
  const { t } = useTranslation();

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [hostname, setHostname] = useState("");
  const [creating, setCreating] = useState(false);

  // API key reveal dialog (after create)
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [copied, setCopied] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [editName, setEditName] = useState("");
  const [editHostname, setEditHostname] = useState("");
  const [editApiKey, setEditApiKey] = useState("");
  const [editApiKeyVisible, setEditApiKeyVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Inline API key visibility per row
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), hostname: hostname.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const agent = await res.json();
      setNewApiKey(agent.apiKey);
      setCreateOpen(false);
      setName("");
      setHostname("");
      setApiKeyDialogOpen(true);
      mutate();
      toast.success(t("agents.created"));
    } catch {
      toast.error("Failed to create agent");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`${res.status}`);
      mutate();
      toast.success(t("agents.deleted"));
    } catch {
      toast.error("Failed to delete agent");
    }
  }

  function openEdit(agent: Agent) {
    setEditAgent(agent);
    setEditName(agent.name);
    setEditHostname(agent.hostname || "");
    setEditApiKey(agent.apiKey);
    setEditApiKeyVisible(false);
    setEditOpen(true);
  }

  async function handleRegenKey() {
    if (!editAgent) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${editAgent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateKey: true }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const updated = await res.json();
      setEditApiKey(updated.apiKey);
      setEditApiKeyVisible(true);
      mutate();
      toast.success(t("agents.updated"));
    } catch {
      toast.error("Failed to regenerate key");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!editAgent || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${editAgent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          hostname: editHostname.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      mutate();
      setEditOpen(false);
      toast.success(t("agents.updated"));
    } catch {
      toast.error("Failed to update agent");
    } finally {
      setSaving(false);
    }
  }

  function handleCopyKey() {
    navigator.clipboard.writeText(newApiKey);
    setCopied(true);
    toast.success(t("agents.apiKeyCopied"));
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleKeyVisibility(id: string) {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("agents.title")}</h1>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("agents.addAgent")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("agents.addAgent")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t("agents.agentName")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("agents.agentNamePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("agents.hostname")}</Label>
                <Input
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  placeholder={t("agents.hostnamePlaceholder")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={creating || !name.trim()}>
                {t("agents.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* API Key display dialog (after create) */}
      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("agents.apiKeyTitle")}</DialogTitle>
            <DialogDescription>{t("agents.apiKeyDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 py-4">
            <Input value={newApiKey} readOnly className="font-mono text-sm" />
            <Button variant="outline" size="icon" onClick={handleCopyKey}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setApiKeyDialogOpen(false)}>
              {t("agents.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit agent dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("agents.editAgent")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("agents.agentName")}</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("agents.agentNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("agents.hostname")}</Label>
              <Input
                value={editHostname}
                onChange={(e) => setEditHostname(e.target.value)}
                placeholder={t("agents.hostnamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("agents.apiKey")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={editApiKeyVisible ? editApiKey : "••••••••••••••••••••••••••••••••"}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setEditApiKeyVisible((v) => !v)}
                  title={editApiKeyVisible ? t("agents.hideKey") : t("agents.showKey")}
                >
                  {editApiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                {editApiKeyVisible && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => { navigator.clipboard.writeText(editApiKey); toast.success(t("agents.apiKeyCopied")); }}
                    title="Copy"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenKey}
                  disabled={saving}
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  {t("agents.regenerateKey")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("agents.keyRegenWarning")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t("agents.cancel")}
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editName.trim()}>
              {t("agents.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>{t("agents.activeAgents")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("agents.name")}</TableHead>
                <TableHead>{t("agents.hostname")}</TableHead>
                <TableHead>{t("agents.status")}</TableHead>
                <TableHead>{t("agents.lastHeartbeat")}</TableHead>
                <TableHead>{t("agents.currentJob")}</TableHead>
                <TableHead>{t("agents.apiKey")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents?.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      {agent.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {agent.hostname || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        agent.status === "online"
                          ? "default"
                          : agent.status === "busy"
                          ? "secondary"
                          : "destructive"
                      }
                      className={
                        agent.status === "online"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : agent.status === "busy"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : undefined
                      }
                    >
                      {agent.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {agent.lastHeartbeat
                      ? formatDistanceToNow(new Date(agent.lastHeartbeat), {
                          addSuffix: true,
                        })
                      : t("agents.never")}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {agent.currentJobId?.slice(0, 8) || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs">
                        {visibleKeys[agent.id]
                          ? agent.apiKey
                          : agent.apiKey.slice(0, 8) + "••••••••"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleKeyVisibility(agent.id)}
                        title={visibleKeys[agent.id] ? t("agents.hideKey") : t("agents.showKey")}
                      >
                        {visibleKeys[agent.id] ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(agent)}
                        title={t("agents.editAgent")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {agent.status !== "offline" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-orange-500"
                          title="Dát offline"
                          onClick={async () => {
                            await fetch(`/api/agents/${agent.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ forceOffline: true }),
                            });
                            mutate();
                            toast.success("Agent dán offline");
                          }}
                        >
                          <WifiOff className="h-4 w-4" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{agent.name}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("agents.deleteConfirm")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("agents.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(agent.id)}>
                              {t("agents.deleteAgent")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!agents || agents.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t("agents.noAgents")}
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

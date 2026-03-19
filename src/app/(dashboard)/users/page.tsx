"use client";

import useSWR from "swr";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslation } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "OPERATOR" | "CLIENT";
  createdAt: string;
  memberships: { organization: { id: string; name: string; slug: string } }[];
}

const roleBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  ADMIN: "default",
  OPERATOR: "secondary",
  CLIENT: "outline",
};

function AddUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "CLIENT" as "ADMIN" | "OPERATOR" | "CLIENT",
  });
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);

  const { data: orgsData } = useSWR<Organization[]>("/api/organizations", fetcher);
  const organizations: Organization[] = orgsData || [];

  function toggleOrg(orgId: string) {
    setSelectedOrgIds((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const payload: Record<string, unknown> = { ...form };
    if (form.role === "CLIENT" && selectedOrgIds.length > 0) {
      payload.organizationIds = selectedOrgIds;
    }
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (res.ok) {
      toast.success(t("toast.userCreated"));
      onCreated();
      onOpenChange(false);
      setForm({ name: "", email: "", password: "", role: "CLIENT" });
      setSelectedOrgIds([]);
    } else {
      const data = await res.json();
      toast.error(data.error || t("toast.userCreateFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("users.dialog.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("users.dialog.name")}</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("users.dialog.namePlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("users.dialog.email")}</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder={t("users.dialog.emailPlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("users.dialog.password")}</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={t("users.dialog.passwordPlaceholder")}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">{t("users.dialog.role")}</Label>
            <Select
              value={form.role}
              onValueChange={(v) => {
                setForm({ ...form, role: v as "ADMIN" | "OPERATOR" | "CLIENT" });
                setSelectedOrgIds([]);
              }}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder={t("users.dialog.selectRole")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">ADMIN</SelectItem>
                <SelectItem value="OPERATOR">OPERATOR</SelectItem>
                <SelectItem value="CLIENT">CLIENT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.role === "CLIENT" && organizations.length > 0 && (
            <div className="space-y-2">
              <Label>{t("users.dialog.organizations") || "Organizations"}</Label>
              <div className="rounded-md border p-3 space-y-2 max-h-48 overflow-y-auto">
                {organizations.map((org) => (
                  <div key={org.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`org-${org.id}`}
                      checked={selectedOrgIds.includes(org.id)}
                      onCheckedChange={() => toggleOrg(org.id)}
                    />
                    <label
                      htmlFor={`org-${org.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {org.name}
                    </label>
                  </div>
                ))}
              </div>
              {selectedOrgIds.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("users.dialog.noOrgSelected") || "No organization selected — will be assigned to default."}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("users.dialog.creating") : t("users.dialog.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  open,
  onOpenChange,
  onUpdated,
}: {
  user: UserRecord | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "OPERATOR" | "CLIENT">("CLIENT");
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: orgsData } = useSWR<Organization[]>(open ? "/api/organizations" : null, fetcher);
  const organizations: Organization[] = orgsData || [];

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email);
      setPassword("");
      setConfirmPassword("");
      setRole(user.role);
      setSelectedOrgIds(user.memberships.map((m) => m.organization.id));
    }
  }, [user]);

  function toggleOrg(orgId: string) {
    setSelectedOrgIds((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
  }

  async function handleSave() {
    if (!user) return;
    if (password && password !== confirmPassword) {
      toast.error(t("users.dialog.passwordMismatch"));
      return;
    }
    setLoading(true);
    const payload: Record<string, unknown> = { name, email, role, organizationIds: selectedOrgIds };
    if (password) payload.password = password;
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (res.ok) {
      toast.success(t("toast.userUpdated"));
      onUpdated();
      onOpenChange(false);
    } else {
      const data = await res.json();
      toast.error(data.error || t("toast.userUpdateFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("users.editDialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">{t("users.dialog.name")}</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("users.dialog.namePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">{t("users.dialog.email")}</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("users.dialog.emailPlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-password">{t("users.dialog.newPassword")}</Label>
            <Input
              id="edit-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("users.dialog.newPasswordPlaceholder")}
            />
          </div>
          {password && (
            <div className="space-y-2">
              <Label htmlFor="edit-confirm-password">{t("users.dialog.confirmPassword")}</Label>
              <Input
                id="edit-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("users.dialog.confirmPassword")}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">{t("users.dialog.passwordMismatch")}</p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label>{t("users.dialog.role")}</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as "ADMIN" | "OPERATOR" | "CLIENT")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">ADMIN</SelectItem>
                <SelectItem value="OPERATOR">OPERATOR</SelectItem>
                <SelectItem value="CLIENT">CLIENT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {organizations.length > 0 && (
            <div className="space-y-2">
              <Label>{t("users.dialog.organizations")}</Label>
              <div className="rounded-md border p-3 space-y-2 max-h-48 overflow-y-auto">
                {organizations.map((org) => (
                  <div key={org.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`edit-org-${org.id}`}
                      checked={selectedOrgIds.includes(org.id)}
                      onCheckedChange={() => toggleOrg(org.id)}
                    />
                    <label
                      htmlFor={`edit-org-${org.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {org.name}
                    </label>
                  </div>
                ))}
              </div>
              {selectedOrgIds.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("users.dialog.noOrgSelected")}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? t("users.roleDialog.saving") : t("users.editDialog.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { t } = useTranslation();
  const { data: users, mutate } = useSWR<UserRecord[]>("/api/users", fetcher);
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteUser) return;
    setDeleting(true);
    const res = await fetch(`/api/users/${deleteUser.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      toast.success(t("toast.userDeleted"));
      mutate();
    } else {
      toast.error(t("toast.userDeleteFailed"));
    }
    setDeleteUser(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("users.title")}</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("users.addUser")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("users.name")}</TableHead>
                <TableHead>{t("users.email")}</TableHead>
                <TableHead>{t("users.role")}</TableHead>
                <TableHead>{t("users.organizations")}</TableHead>
                <TableHead>{t("users.created")}</TableHead>
                <TableHead className="text-right">{t("users.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name || "—"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant[user.role] || "outline"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.memberships.map((m) => m.organization.name).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(user.createdAt), "d.M.yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditUser(user)}
                      >
                        <UserCog className="mr-1 h-3 w-3" />
                        {t("users.editUser") || "Upravit"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteUser(user)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        {t("common.delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!users || users.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t("users.noUsers")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddUserDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => mutate()}
      />

      <EditUserDialog
        user={editUser}
        open={!!editUser}
        onOpenChange={(v) => { if (!v) setEditUser(null); }}
        onUpdated={() => mutate()}
      />

      <AlertDialog open={!!deleteUser} onOpenChange={(v) => { if (!v) setDeleteUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("users.deleteUser")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("users.deleteConfirm")}
              {deleteUser && (
                <span className="block mt-1 font-medium">{deleteUser.email}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

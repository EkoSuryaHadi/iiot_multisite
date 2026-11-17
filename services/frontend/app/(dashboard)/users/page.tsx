"use client";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import RoleGate from "@/components/shared/role-gate";
import TenantSelector from "@/components/shared/tenant-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenantContext } from "@/contexts/TenantContext";
import { ApiRequestError, sitesApi, usersApi } from "@/lib/api-client";
import type { AppUser, Site, UserRole } from "@/lib/types";
import { KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const ROLE_LABEL: Record<UserRole, string> = {
  superadmin: "Superadmin",
  tenant_admin: "Tenant Admin",
  operator: "Operator",
  viewer: "Viewer",
};

function ChangePasswordDialog({ user, onUpdated }: { user: AppUser; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const accountLabel = user.username || user.email || user.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }
    setSubmitting(true);
    try {
      await usersApi.update(user.id, { password });
      toast.success(`Password untuk ${accountLabel} berhasil direset`);
      setOpen(false);
      setPassword("");
      onUpdated();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal mengubah password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={user.password_reset_requested_at ? "default" : "outline"}
          size="sm"
          title="Reset / Forgot Password User"
        >
          <KeyRound className="w-4 h-4 mr-1" /> Reset Password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset / Ubah Password User</DialogTitle>
          <DialogDescription>
            Masukkan password baru untuk <strong>{accountLabel}</strong>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`new-pw-${user.id}`}>Password Baru</Label>
            <Input
              id={`new-pw-${user.id}`}
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              minLength={6}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserDialog({
  tenantId,
  sites,
  onCreated,
}: {
  tenantId?: string;
  sites: Site[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [siteScope, setSiteScope] = useState<string>("ALL");
  const [submitting, setSubmitting] = useState(false);
  const { isSuperadmin } = useTenantContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuperadmin && role !== "superadmin" && !tenantId) {
      toast.error("Pilih Group Utama (Tenant) terlebih dahulu");
      return;
    }
    const cleanUsername = username.trim();
    const cleanEmail = email.trim();
    if (!cleanUsername && !cleanEmail) {
      toast.error("Isi minimal Username atau Email");
      return;
    }
    setSubmitting(true);
    try {
      await usersApi.create({
        username: cleanUsername || undefined,
        email: cleanEmail || undefined,
        password,
        role,
        tenant_id: role === "superadmin" ? undefined : tenantId,
        site_id: role === "superadmin" || siteScope === "ALL" ? null : siteScope,
      });
      toast.success("User berhasil dibuat");
      setOpen(false);
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("viewer");
      setSiteScope("ALL");
      onCreated();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal membuat user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> User Baru
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat User Baru</DialogTitle>
          <DialogDescription>
            Isi Username dan/atau Email (password minimal 6 karakter). Bisa dibatasi ke 1 Child Node (Site) tertentu.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="deden_datasystem (opsional jika Email diisi)"
              pattern="^[a-zA-Z0-9._-]+$"
              minLength={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com (opsional jika Username diisi)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role !== "superadmin" && (
            <div className="space-y-1.5">
              <Label>Akses Child Node (Site)</Label>
              <Select value={siteScope} onValueChange={setSiteScope}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Child Node di Group Utama (Tenant)</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UsersPageContent() {
  const { isSuperadmin, selectedTenant } = useTenantContext();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, allSites] = await Promise.all([usersApi.list(), sitesApi.list()]);
      setUsers(isSuperadmin && selectedTenant ? all.filter((u) => u.tenant_id === selectedTenant.id) : all);
      setSites(isSuperadmin && selectedTenant ? allSites.filter((s) => s.tenant_id === selectedTenant.id) : allSites);
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal memuat user");
    } finally {
      setLoading(false);
    }
  }, [isSuperadmin, selectedTenant]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (user: AppUser) => {
    try {
      await usersApi.update(user.id, { is_active: !user.is_active });
      toast.success(`User ${user.is_active ? "dinonaktifkan" : "diaktifkan"}`);
      load();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal mengubah status");
    }
  };

  const handleSiteScopeChange = async (user: AppUser, nextScope: string) => {
    try {
      await usersApi.update(user.id, { site_id: nextScope === "ALL" ? null : nextScope });
      toast.success("Scope Child Node (Site) user diperbarui");
      load();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal mengubah scope site");
    }
  };

  const handleDelete = async (user: AppUser) => {
    const label = user.username || user.email || user.id;
    if (!confirm(`Hapus user "${label}"?`)) return;
    try {
      await usersApi.remove(user.id);
      toast.success("User dihapus");
      load();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal menghapus user");
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <DashboardBreadcrumb title="USERS" text="Users" />
        <div className="flex items-center gap-3">
          <TenantSelector />
          <CreateUserDialog tenantId={selectedTenant?.id} sites={sites} onCreated={load} />
        </div>
      </div>

      <Card className="card">
        <CardContent className="px-0">
          {loading ? (
            <p className="text-sm text-neutral-500 px-6">Memuat...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-neutral-500 px-6">
              {isSuperadmin && selectedTenant
                ? `Belum ada user di Group Utama ${selectedTenant.name}.`
                : "Belum ada user."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username / Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Scope Child Node (Site)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <span>{user.username || user.email}</span>
                        {user.username && user.email && (
                          <span className="text-xs text-neutral-500">{user.email}</span>
                        )}
                        {user.password_reset_requested_at && (
                          <Badge className="w-fit bg-amber-500 text-white text-[10px]">
                            Minta Reset Password
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{ROLE_LABEL[user.role]}</TableCell>
                    <TableCell>
                      {user.role === "superadmin" ? (
                        <span className="text-xs text-neutral-500">Lintas Group</span>
                      ) : (
                        <Select
                          value={user.site_id || "ALL"}
                          onValueChange={(val) => handleSiteScopeChange(user, val)}
                        >
                          <SelectTrigger className="w-44 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">Semua Site di Group</SelectItem>
                            {sites
                              .filter((s) => !user.tenant_id || s.tenant_id === user.tenant_id)
                              .map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name} ({s.slug})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={user.is_active ? "bg-green-600 text-white" : "bg-neutral-400 text-white"}>
                        {user.is_active ? "aktif" : "nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-neutral-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <ChangePasswordDialog user={user} onUpdated={load} />
                        <Button variant="outline" size="sm" onClick={() => toggleActive(user)}>
                          {user.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(user)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function UsersPage() {
  return (
    <RoleGate allow={["superadmin", "tenant_admin"]}>
      <UsersPageContent />
    </RoleGate>
  );
}

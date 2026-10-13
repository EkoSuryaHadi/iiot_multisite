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
import { ApiRequestError, usersApi } from "@/lib/api-client";
import type { AppUser, UserRole } from "@/lib/types";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const ROLE_LABEL: Record<UserRole, string> = {
  superadmin: "Superadmin",
  tenant_admin: "Tenant Admin",
  operator: "Operator",
  viewer: "Viewer",
};

function CreateUserDialog({ tenantId, onCreated }: { tenantId?: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [submitting, setSubmitting] = useState(false);
  const { isSuperadmin } = useTenantContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuperadmin && role !== "superadmin" && !tenantId) {
      toast.error("Pilih tenant terlebih dahulu");
      return;
    }
    setSubmitting(true);
    try {
      await usersApi.create({ email, password, role, tenant_id: role === "superadmin" ? undefined : tenantId });
      toast.success("User berhasil dibuat");
      setOpen(false);
      setEmail("");
      setPassword("");
      setRole("viewer");
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
          <DialogDescription>Password minimal 6 karakter.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (isSuperadmin && !selectedTenant) return;
    setLoading(true);
    try {
      const all = await usersApi.list();
      setUsers(isSuperadmin && selectedTenant ? all.filter((u) => u.tenant_id === selectedTenant.id) : all);
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

  const handleDelete = async (user: AppUser) => {
    if (!confirm(`Hapus user "${user.email}"?`)) return;
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
          <CreateUserDialog tenantId={selectedTenant?.id} onCreated={load} />
        </div>
      </div>

      <Card className="card">
        <CardContent className="px-0">
          {loading ? (
            <p className="text-sm text-neutral-500 px-6">Memuat...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-neutral-500 px-6">Belum ada user.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{ROLE_LABEL[user.role]}</TableCell>
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

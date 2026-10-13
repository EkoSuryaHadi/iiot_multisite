"use client";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import RoleGate from "@/components/shared/role-gate";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenantContext } from "@/contexts/TenantContext";
import { ApiRequestError, tenantsApi } from "@/lib/api-client";
import type { Tenant } from "@/lib/types";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

function CreateTenantDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await tenantsApi.create({ slug, name });
      toast.success("Tenant berhasil dibuat");
      setOpen(false);
      setSlug("");
      setName("");
      onCreated();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal membuat tenant");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Tenant Baru
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat Tenant Baru</DialogTitle>
          <DialogDescription>Slug hanya huruf kecil, angka, dan tanda hubung.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="acme"
              required
              pattern="^[a-z0-9-]+$"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" required />
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

function TenantsPageContent() {
  const { tenants, tenantsLoading, refreshTenants } = useTenantContext();

  const toggleActive = async (tenant: Tenant) => {
    try {
      await tenantsApi.update(tenant.id, { is_active: !tenant.is_active });
      toast.success(`Tenant ${tenant.is_active ? "dinonaktifkan" : "diaktifkan"}`);
      refreshTenants();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal mengubah status");
    }
  };

  const handleDelete = async (tenant: Tenant) => {
    if (!confirm(`Hapus tenant "${tenant.name}"? Semua site, device, dan user di dalamnya juga akan terhapus.`)) return;
    try {
      await tenantsApi.remove(tenant.id);
      toast.success("Tenant dihapus");
      refreshTenants();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal menghapus tenant");
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <DashboardBreadcrumb title="TENANTS" text="Tenants" />
        <CreateTenantDialog onCreated={refreshTenants} />
      </div>

      <Card className="card">
        <CardContent className="px-0">
          {tenantsLoading ? (
            <p className="text-sm text-neutral-500 px-6">Memuat...</p>
          ) : tenants.length === 0 ? (
            <p className="text-sm text-neutral-500 px-6">Belum ada tenant.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.slug}</TableCell>
                    <TableCell>{tenant.name}</TableCell>
                    <TableCell>
                      <Badge
                        className={tenant.is_active ? "bg-green-600 text-white" : "bg-neutral-400 text-white"}
                      >
                        {tenant.is_active ? "aktif" : "nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-neutral-500">
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => toggleActive(tenant)}>
                          {tenant.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(tenant)}>
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

export default function TenantsPage() {
  return (
    <RoleGate allow={["superadmin"]}>
      <TenantsPageContent />
    </RoleGate>
  );
}

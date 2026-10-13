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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenantContext } from "@/contexts/TenantContext";
import { ApiRequestError, sitesApi } from "@/lib/api-client";
import type { Site } from "@/lib/types";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

function CreateSiteDialog({ tenantId, onCreated }: { tenantId?: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { isSuperadmin } = useTenantContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuperadmin && !tenantId) {
      toast.error("Pilih tenant terlebih dahulu");
      return;
    }
    setSubmitting(true);
    try {
      await sitesApi.create({ slug, name, tenant_id: tenantId });
      toast.success("Site berhasil dibuat");
      setOpen(false);
      setSlug("");
      setName("");
      onCreated();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal membuat site");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Site Baru
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat Site Baru</DialogTitle>
          <DialogDescription>Slug unik di dalam tenant yang sedang aktif.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="jkt"
              required
              pattern="^[a-z0-9-]+$"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jakarta" required />
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

function SitesPageContent() {
  const { isSuperadmin, selectedTenant } = useTenantContext();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (isSuperadmin && !selectedTenant) return;
    setLoading(true);
    try {
      const all = await sitesApi.list();
      setSites(isSuperadmin && selectedTenant ? all.filter((s) => s.tenant_id === selectedTenant.id) : all);
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal memuat site");
    } finally {
      setLoading(false);
    }
  }, [isSuperadmin, selectedTenant]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (site: Site) => {
    try {
      await sitesApi.update(site.id, { is_active: !site.is_active });
      toast.success(`Site ${site.is_active ? "dinonaktifkan" : "diaktifkan"}`);
      load();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal mengubah status");
    }
  };

  const handleDelete = async (site: Site) => {
    if (!confirm(`Hapus site "${site.name}"? Semua device di dalamnya juga akan terhapus.`)) return;
    try {
      await sitesApi.remove(site.id);
      toast.success("Site dihapus");
      load();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal menghapus site");
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <DashboardBreadcrumb title="SITES" text="Sites" />
        <div className="flex items-center gap-3">
          <TenantSelector />
          <RoleGate allow={["superadmin", "tenant_admin"]}>
            <CreateSiteDialog tenantId={selectedTenant?.id} onCreated={load} />
          </RoleGate>
        </div>
      </div>

      <Card className="card">
        <CardContent className="px-0">
          {loading ? (
            <p className="text-sm text-neutral-500 px-6">Memuat...</p>
          ) : sites.length === 0 ? (
            <p className="text-sm text-neutral-500 px-6">Belum ada site.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <RoleGate allow={["superadmin", "tenant_admin"]}>
                    <TableHead className="text-right">Aksi</TableHead>
                  </RoleGate>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell className="font-medium">{site.slug}</TableCell>
                    <TableCell>{site.name}</TableCell>
                    <TableCell>
                      <Badge className={site.is_active ? "bg-green-600 text-white" : "bg-neutral-400 text-white"}>
                        {site.is_active ? "aktif" : "nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-neutral-500">
                      {new Date(site.created_at).toLocaleDateString()}
                    </TableCell>
                    <RoleGate allow={["superadmin", "tenant_admin"]}>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => toggleActive(site)}>
                            {site.is_active ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(site)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </RoleGate>
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

export default function SitesPage() {
  return (
    <RoleGate allow={["superadmin", "tenant_admin", "operator", "viewer"]}>
      <SitesPageContent />
    </RoleGate>
  );
}

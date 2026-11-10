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
import { SiteMapView } from "@/components/sites/site-map-view";
import { useTenantContext } from "@/contexts/TenantContext";
import { ApiRequestError, devicesApi, sitesApi } from "@/lib/api-client";
import type { Device, Site } from "@/lib/types";
import {
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Radio,
  Server,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const SPS_TYPE_PRESETS: Record<
  string,
  {
    pv: number;
    mppt: number;
    float: number;
    baseline: number;
    label: string;
  }
> = {
  TYPE_A: {
    pv: 5.85,
    mppt: 80,
    float: 53.5,
    baseline: 72,
    label: "Tipe A (3.0 kW / 5.85 kWp / 80 A)",
  },
  TYPE_B: {
    pv: 8.2,
    mppt: 100,
    float: 53.5,
    baseline: 108,
    label: "Tipe B (4.5 kW / 8.2 kWp / 100 A)",
  },
  TYPE_C: {
    pv: 11.7,
    mppt: 160,
    float: 53.5,
    baseline: 144,
    label: "Tipe C (6.0 kW / 11.7 kWp / 2x80 A)",
  },
  TYPE_D: {
    pv: 14.0,
    mppt: 200,
    float: 53.5,
    baseline: 180,
    label: "Tipe D (7.5 kW / 14.0 kWp / 2x100 A)",
  },
};

function CreateSiteDialog({
  tenantId,
  onCreated,
}: {
  tenantId?: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [siteType, setSiteType] = useState<string>("NONE");
  const [pvCapacity, setPvCapacity] = useState("");
  const [mpptCapacity, setMpptCapacity] = useState("");
  const [rectifierFloat, setRectifierFloat] = useState("");
  const [baselineKwh, setBaselineKwh] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [towerType, setTowerType] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { isSuperadmin } = useTenantContext();

  const handleTypeChange = (value: string) => {
    setSiteType(value);
    if (value && SPS_TYPE_PRESETS[value]) {
      const preset = SPS_TYPE_PRESETS[value];
      setPvCapacity(preset.pv.toString());
      setMpptCapacity(preset.mppt.toString());
      setRectifierFloat(preset.float.toString());
      setBaselineKwh(preset.baseline.toString());
    }
  };

  const resetForm = () => {
    setSlug("");
    setName("");
    setSiteType("NONE");
    setPvCapacity("");
    setMpptCapacity("");
    setRectifierFloat("");
    setBaselineKwh("");
    setLatitude("");
    setLongitude("");
    setTowerType("");
    setShowAdvanced(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuperadmin && !tenantId) {
      toast.error("Pilih tenant terlebih dahulu");
      return;
    }
    setSubmitting(true);
    try {
      await sitesApi.create({
        slug,
        name,
        tenant_id: tenantId,
        site_type: siteType === "NONE" ? null : siteType,
        pv_capacity_kwp: pvCapacity ? parseFloat(pvCapacity) : null,
        mppt_capacity_a: mpptCapacity ? parseFloat(mpptCapacity) : null,
        rectifier_float_voltage: rectifierFloat ? parseFloat(rectifierFloat) : null,
        baseline_kwh_daily: baselineKwh ? parseFloat(baselineKwh) : null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        tower_type: towerType || null,
      });
      toast.success("Site berhasil dibuat");
      setOpen(false);
      resetForm();
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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Site Baru</DialogTitle>
          <DialogDescription>
            Slug unik di dalam tenant aktif. Anda juga dapat menentukan spesifikasi teknis SPS On-Grid & titik koordinat.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="slug">
                Slug <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="misal: jkt-01"
                required
                pattern="^[a-z0-9-]+$"
              />
              <p className="text-[11px] text-neutral-400">Huruf kecil, angka, atau tanda hubung (-)</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Nama Site <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="misal: Site TB Simatupang"
                required
              />
            </div>
          </div>

          {/* Konfigurasi SPS On-Grid & Lokasi */}
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3.5 space-y-3.5 bg-neutral-50/50 dark:bg-neutral-900/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" /> Spesifikasi SPS & Lokasi (Opsional)
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary px-2"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? "Sembunyikan Detail" : "Tampilkan Detail"}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="site_type" className="text-xs">
                  Tipe Konfigurasi SPS
                </Label>
                <Select value={siteType} onValueChange={handleTypeChange}>
                  <SelectTrigger id="site_type" className="h-9 text-xs">
                    <SelectValue placeholder="Pilih Tipe SPS..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Standar / Tanpa Preset</SelectItem>
                    <SelectItem value="TYPE_A">Tipe A (5.85 kWp / 80 A)</SelectItem>
                    <SelectItem value="TYPE_B">Tipe B (8.20 kWp / 100 A)</SelectItem>
                    <SelectItem value="TYPE_C">Tipe C (11.70 kWp / 2x80 A)</SelectItem>
                    <SelectItem value="TYPE_D">Tipe D (14.00 kWp / 2x100 A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pv_capacity" className="text-xs">
                  Kapasitas PV (kWp)
                </Label>
                <Input
                  id="pv_capacity"
                  type="number"
                  step="0.01"
                  value={pvCapacity}
                  onChange={(e) => setPvCapacity(e.target.value)}
                  placeholder="5.85"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {showAdvanced && (
              <div className="space-y-3 pt-2 border-t border-neutral-200/80 dark:border-neutral-800">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="mppt_capacity" className="text-[11px]">
                      Kapasitas MPPT (A)
                    </Label>
                    <Input
                      id="mppt_capacity"
                      type="number"
                      step="0.1"
                      value={mpptCapacity}
                      onChange={(e) => setMpptCapacity(e.target.value)}
                      placeholder="80"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rectifier_float" className="text-[11px]">
                      Float Rectifier (V)
                    </Label>
                    <Input
                      id="rectifier_float"
                      type="number"
                      step="0.1"
                      value={rectifierFloat}
                      onChange={(e) => setRectifierFloat(e.target.value)}
                      placeholder="53.5"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="baseline_kwh" className="text-[11px]">
                      Baseline PLN (kWh/hari)
                    </Label>
                    <Input
                      id="baseline_kwh"
                      type="number"
                      step="0.1"
                      value={baselineKwh}
                      onChange={(e) => setBaselineKwh(e.target.value)}
                      placeholder="72.0"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="latitude" className="text-[11px]">
                      Latitude GPS (Lintang)
                    </Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="0.0001"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="-6.2088"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="longitude" className="text-[11px]">
                      Longitude GPS (Bujur)
                    </Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="0.0001"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="106.8456"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="tower_type" className="text-[11px]">
                      Tipe Menara
                    </Label>
                    <Input
                      id="tower_type"
                      value={towerType}
                      onChange={(e) => setTowerType(e.target.value)}
                      placeholder="4 Legged 72M"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Site"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditSiteDialog({
  site,
  open,
  onOpenChange,
  onUpdated,
}: {
  site: Site | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState("");
  const [siteType, setSiteType] = useState<string>("NONE");
  const [pvCapacity, setPvCapacity] = useState("");
  const [mpptCapacity, setMpptCapacity] = useState("");
  const [rectifierFloat, setRectifierFloat] = useState("");
  const [baselineKwh, setBaselineKwh] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [towerType, setTowerType] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (site) {
      setName(site.name || "");
      setSiteType(site.site_type || "NONE");
      setPvCapacity(site.pv_capacity_kwp != null ? site.pv_capacity_kwp.toString() : "");
      setMpptCapacity(site.mppt_capacity_a != null ? site.mppt_capacity_a.toString() : "");
      setRectifierFloat(site.rectifier_float_voltage != null ? site.rectifier_float_voltage.toString() : "");
      setBaselineKwh(site.baseline_kwh_daily != null ? site.baseline_kwh_daily.toString() : "");
      setLatitude(site.latitude != null ? site.latitude.toString() : "");
      setLongitude(site.longitude != null ? site.longitude.toString() : "");
      setTowerType(site.tower_type || "");
    }
  }, [site]);

  const handleTypeChange = (value: string) => {
    setSiteType(value);
    if (value && SPS_TYPE_PRESETS[value]) {
      const preset = SPS_TYPE_PRESETS[value];
      setPvCapacity(preset.pv.toString());
      setMpptCapacity(preset.mppt.toString());
      setRectifierFloat(preset.float.toString());
      setBaselineKwh(preset.baseline.toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!site) return;
    setSubmitting(true);
    try {
      await sitesApi.update(site.id, {
        name,
        site_type: siteType === "NONE" ? null : siteType,
        pv_capacity_kwp: pvCapacity ? parseFloat(pvCapacity) : null,
        mppt_capacity_a: mpptCapacity ? parseFloat(mpptCapacity) : null,
        rectifier_float_voltage: rectifierFloat ? parseFloat(rectifierFloat) : null,
        baseline_kwh_daily: baselineKwh ? parseFloat(baselineKwh) : null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        tower_type: towerType || null,
      });
      toast.success("Site berhasil diperbarui");
      onOpenChange(false);
      onUpdated();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal memperbarui site");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Site: {site?.name}</DialogTitle>
          <DialogDescription>
            Ubah nama, konfigurasi tipe SPS, dan koordinat geografis site.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-slug">Slug (Tidak dapat diubah)</Label>
              <Input id="edit-slug" value={site?.slug || ""} disabled className="bg-neutral-100 dark:bg-neutral-800" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">
                Nama Site <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama site..."
                required
              />
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3.5 space-y-3.5 bg-neutral-50/50 dark:bg-neutral-900/50">
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Spesifikasi SPS & Lokasi
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-site-type" className="text-xs">
                  Tipe Konfigurasi SPS
                </Label>
                <Select value={siteType} onValueChange={handleTypeChange}>
                  <SelectTrigger id="edit-site-type" className="h-9 text-xs">
                    <SelectValue placeholder="Pilih Tipe SPS..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Standar / Tanpa Preset</SelectItem>
                    <SelectItem value="TYPE_A">Tipe A (5.85 kWp / 80 A)</SelectItem>
                    <SelectItem value="TYPE_B">Tipe B (8.20 kWp / 100 A)</SelectItem>
                    <SelectItem value="TYPE_C">Tipe C (11.70 kWp / 2x80 A)</SelectItem>
                    <SelectItem value="TYPE_D">Tipe D (14.00 kWp / 2x100 A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-pv-capacity" className="text-xs">
                  Kapasitas PV (kWp)
                </Label>
                <Input
                  id="edit-pv-capacity"
                  type="number"
                  step="0.01"
                  value={pvCapacity}
                  onChange={(e) => setPvCapacity(e.target.value)}
                  placeholder="5.85"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-neutral-200/80 dark:border-neutral-800">
              <div className="space-y-1">
                <Label htmlFor="edit-mppt-capacity" className="text-[11px]">
                  Kapasitas MPPT (A)
                </Label>
                <Input
                  id="edit-mppt-capacity"
                  type="number"
                  step="0.1"
                  value={mpptCapacity}
                  onChange={(e) => setMpptCapacity(e.target.value)}
                  placeholder="80"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-rectifier-float" className="text-[11px]">
                  Float Rectifier (V)
                </Label>
                <Input
                  id="edit-rectifier-float"
                  type="number"
                  step="0.1"
                  value={rectifierFloat}
                  onChange={(e) => setRectifierFloat(e.target.value)}
                  placeholder="53.5"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-baseline-kwh" className="text-[11px]">
                  Baseline PLN (kWh/hari)
                </Label>
                <Input
                  id="edit-baseline-kwh"
                  type="number"
                  step="0.1"
                  value={baselineKwh}
                  onChange={(e) => setBaselineKwh(e.target.value)}
                  placeholder="72.0"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-latitude" className="text-[11px]">
                  Latitude GPS
                </Label>
                <Input
                  id="edit-latitude"
                  type="number"
                  step="0.0001"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="-6.2088"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-longitude" className="text-[11px]">
                  Longitude GPS
                </Label>
                <Input
                  id="edit-longitude"
                  type="number"
                  step="0.0001"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="106.8456"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-tower-type" className="text-[11px]">
                  Tipe Menara
                </Label>
                <Input
                  id="edit-tower-type"
                  value={towerType}
                  onChange={(e) => setTowerType(e.target.value)}
                  placeholder="4 Legged 72M"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Perubahan"}
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
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSite, setEditingSite] = useState<Site | null>(null);

  const load = useCallback(async () => {
    if (isSuperadmin && !selectedTenant) {
      setSites([]);
      setDevices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [allSites, allDevices] = await Promise.all([
        sitesApi.list(),
        devicesApi.list().catch(() => [] as Device[]),
      ]);
      setSites(isSuperadmin && selectedTenant ? allSites.filter((s) => s.tenant_id === selectedTenant.id) : allSites);
      setDevices(isSuperadmin && selectedTenant ? allDevices.filter((d) => d.tenant_id === selectedTenant.id) : allDevices);
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
    const siteDevices = devices.filter((d) => d.site_id === site.id);
    const warningMsg =
      siteDevices.length > 0
        ? `Hapus site "${site.name}"? PERINGATAN: ${siteDevices.length} device yang terpasang di site ini juga akan terhapus!`
        : `Hapus site "${site.name}"?`;

    if (!confirm(warningMsg)) return;
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

      {!loading && sites.length > 0 && (
        <div className="mb-6">
          <SiteMapView sites={sites} devices={devices} />
        </div>
      )}

      <Card className="card">
        <CardContent className="px-0">
          {loading ? (
            <p className="text-sm text-neutral-500 px-6">Memuat...</p>
          ) : isSuperadmin && !selectedTenant ? (
            <p className="text-sm text-neutral-500 px-6">Pilih atau buat tenant terlebih dahulu untuk melihat daftar site.</p>
          ) : sites.length === 0 ? (
            <p className="text-sm text-neutral-500 px-6">Belum ada site.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Nama Site</TableHead>
                  <TableHead>Konfigurasi SPS</TableHead>
                  <TableHead>Perangkat Terpasang</TableHead>
                  <TableHead>Koordinat</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <RoleGate allow={["superadmin", "tenant_admin"]}>
                    <TableHead className="text-right">Aksi</TableHead>
                  </RoleGate>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => {
                  const siteDevices = devices.filter((d) => d.site_id === site.id);
                  const onlineCount = siteDevices.filter((d) => d.is_active).length;

                  return (
                    <TableRow key={site.id}>
                      <TableCell className="font-mono text-xs font-semibold">{site.slug}</TableCell>
                      <TableCell>
                        <div className="font-medium text-neutral-900 dark:text-neutral-100">{site.name}</div>
                        {site.tower_type && (
                          <div className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5">
                            <Radio className="w-3 h-3 text-sky-500" />
                            {site.tower_type}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {site.site_type ? (
                          <div className="space-y-0.5">
                            <Badge variant="outline" className="text-[10px] font-semibold bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300">
                              {site.site_type}
                            </Badge>
                            {site.pv_capacity_kwp != null && (
                              <div className="text-[11px] text-neutral-500 flex items-center gap-1">
                                <Zap className="w-3 h-3 text-amber-500" />
                                {site.pv_capacity_kwp} kWp
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/devices?site=${site.id}`}
                          className="group inline-flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300 hover:text-primary transition-colors"
                        >
                          <Server className="w-3.5 h-3.5 text-neutral-400 group-hover:text-primary" />
                          <span>
                            {siteDevices.length} unit
                            <span className="text-neutral-400 text-[11px] ml-1">
                              ({onlineCount} online)
                            </span>
                          </span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </TableCell>
                      <TableCell>
                        {site.latitude != null && site.longitude != null ? (
                          <div className="text-xs font-mono text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                            <span>
                              {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={site.is_active ? "bg-emerald-600 text-white text-[11px]" : "bg-neutral-400 text-white text-[11px]"}>
                          {site.is_active ? "aktif" : "nonaktif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-neutral-500">
                        {new Date(site.created_at).toLocaleDateString()}
                      </TableCell>
                      <RoleGate allow={["superadmin", "tenant_admin"]}>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5"
                              title="Edit Site"
                              onClick={() => setEditingSite(site)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => toggleActive(site)}
                            >
                              {site.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 px-2.5"
                              title="Hapus Site"
                              onClick={() => handleDelete(site)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </RoleGate>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditSiteDialog
        site={editingSite}
        open={!!editingSite}
        onOpenChange={(open) => !open && setEditingSite(null)}
        onUpdated={load}
      />
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

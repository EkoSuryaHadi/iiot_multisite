"use client";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import RoleGate from "@/components/shared/role-gate";
import TenantSelector from "@/components/shared/tenant-selector";
import { MqttSetupDialog } from "@/components/devices/mqtt-setup-dialog";
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
import { useAutoRefresh } from "@/contexts/AutoRefreshContext";
import { ApiRequestError, devicesApi, sitesApi, analyticsApi } from "@/lib/api-client";
import type { Device, DeviceCredential, DeviceStatusItem, Site } from "@/lib/types";
import { formatTimeAgo, StatusPulse } from "@/components/shared/status-pulse";
import { Copy, Filter, KeyRound, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

function CreateDeviceDialog({
  tenantId,
  sites,
  onCreated,
}: {
  tenantId?: string;
  sites: Site[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deviceKey, setDeviceKey] = useState("");
  const [name, setName] = useState("");
  const [siteId, setSiteId] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const { isSuperadmin } = useTenantContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuperadmin && !tenantId) {
      toast.error("Pilih Group Utama (Tenant) pada header terlebih dahulu");
      return;
    }
    if (!siteId) {
      toast.error("Pilih Child Node (Site) terlebih dahulu");
      return;
    }
    setSubmitting(true);
    try {
      await devicesApi.create({ device_key: deviceKey, name, site_id: siteId, tenant_id: tenantId });
      toast.success("Device berhasil dibuat");
      setOpen(false);
      setDeviceKey("");
      setName("");
      setSiteId(undefined);
      onCreated();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal membuat device");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Device Baru
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat Device / Sensor Baru</DialogTitle>
          <DialogDescription>Device Key unik (tanpa spasi) di dalam Group Utama (Tenant) yang aktif.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Child Node (Site)</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih child node (site)" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="device_key">Device Key</Label>
            <Input
              id="device_key"
              value={deviceKey}
              onChange={(e) => setDeviceKey(e.target.value)}
              placeholder="E0247Salemba"
              required
              pattern="^[a-zA-Z0-9_-]+$"
              title="Hanya huruf, angka, tanda hubung (-), atau garis bawah (_) tanpa spasi"
            />
            <p className="text-[11px] text-neutral-500">
              Hanya huruf, angka, <code>-</code>, atau <code>_</code> tanpa spasi (dipakai pada topik MQTT &amp; Client ID).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama / Deskripsi</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Epever Site E0247Salemba" required />
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

function CredentialResultDialog({
  credential,
  onClose,
}: {
  credential: DeviceCredential | null;
  onClose: () => void;
}) {
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Disalin ke clipboard");
  };

  return (
    <Dialog open={!!credential} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kredensial MQTT Device</DialogTitle>
          <DialogDescription className="text-red-500">
            Password hanya ditampilkan sekali. Simpan sekarang - tidak bisa dilihat lagi setelah dialog ini ditutup.
          </DialogDescription>
        </DialogHeader>
        {credential && (
          <div className="space-y-3 text-sm">
            <div>
              <Label className="mb-1">Client ID</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={credential.client_id} />
                <Button type="button" variant="outline" size="icon" onClick={() => copy(credential.client_id)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="mb-1">Password</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={credential.password} />
                <Button type="button" variant="outline" size="icon" onClick={() => copy(credential.password)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="mb-1">Topic Prefix</Label>
              <Input readOnly value={credential.mqtt_topic_prefix} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Selesai</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DevicesPageContent() {
  const { isSuperadmin, selectedTenant } = useTenantContext();
  const { refreshTrigger } = useAutoRefresh();
  const searchParams = useSearchParams();
  const siteQueryParam = searchParams.get("site");

  const [devices, setDevices] = useState<Device[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>("ALL");
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, DeviceStatusItem>>({});
  const [loading, setLoading] = useState(true);
  const [credential, setCredential] = useState<DeviceCredential | null>(null);
  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const [resetTargetDevice, setResetTargetDevice] = useState<Device | null>(null);

  // Sync query param with state if provided
  useEffect(() => {
    if (siteQueryParam) {
      setSelectedSiteFilter(siteQueryParam);
    }
  }, [siteQueryParam]);

  const siteNameById = (id: string) => sites.find((s) => s.id === id)?.name ?? id;

  const load = useCallback(async () => {
    if (isSuperadmin && !selectedTenant) {
      setDevices([]);
      setSites([]);
      setDeviceStatuses({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [allDevices, allSites, statusRes] = await Promise.all([
        devicesApi.list(),
        sitesApi.list(),
        analyticsApi
          .getDevicesStatus({
            tenant_slug: isSuperadmin ? selectedTenant?.slug : undefined,
            limit: 100,
          })
          .catch(() => null),
      ]);

      const statusMap: Record<string, DeviceStatusItem> = {};
      if (statusRes?.devices) {
        for (const item of statusRes.devices) {
          statusMap[item.device_key] = item;
        }
      }
      setDeviceStatuses(statusMap);

      if (isSuperadmin && selectedTenant) {
        setDevices(allDevices.filter((d) => d.tenant_id === selectedTenant.id));
        setSites(allSites.filter((s) => s.tenant_id === selectedTenant.id));
      } else {
        setDevices(allDevices);
        setSites(allSites);
      }
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal memuat device");
    } finally {
      setLoading(false);
    }
  }, [isSuperadmin, selectedTenant]);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  const toggleActive = async (device: Device) => {
    try {
      await devicesApi.update(device.id, { is_active: !device.is_active });
      toast.success(`Device ${device.is_active ? "dinonaktifkan" : "diaktifkan"}`);
      load();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal mengubah status");
    }
  };

  const handleDelete = async (device: Device) => {
    if (!confirm(`Hapus device "${device.name}"?`)) return;
    try {
      await devicesApi.remove(device.id);
      toast.success("Device dihapus");
      load();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal menghapus device");
    }
  };

  const handleProvision = async (device: Device, reset = false) => {
    setProvisioningId(device.id);
    try {
      const result = await devicesApi.provisionCredentials(device.id, reset);
      setCredential(result);
      setResetTargetDevice(null);
      load();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal provisioning kredensial");
    } finally {
      setProvisioningId(null);
    }
  };

  const filteredDevices = devices.filter((d) => {
    if (selectedSiteFilter !== "ALL" && d.site_id !== selectedSiteFilter) {
      return false;
    }
    return true;
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <DashboardBreadcrumb title="DEVICES" text="Devices" />
        <div className="flex items-center gap-2.5 flex-wrap">
          {sites.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-neutral-400" />
              <Select value={selectedSiteFilter} onValueChange={setSelectedSiteFilter}>
                <SelectTrigger className="w-52 h-9 text-xs">
                  <SelectValue placeholder="Semua Child Node (Site)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Child Node ({devices.length})</SelectItem>
                  {sites.map((s) => {
                    const count = devices.filter((d) => d.site_id === s.id).length;
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({count})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
          <TenantSelector />
          <RoleGate allow={["superadmin", "tenant_admin", "operator"]}>
            <CreateDeviceDialog tenantId={selectedTenant?.id} sites={sites} onCreated={load} />
          </RoleGate>
        </div>
      </div>

      <Card className="card">
        <CardContent className="px-0">
          {loading ? (
            <p className="text-sm text-neutral-500 px-6">Memuat...</p>
          ) : isSuperadmin && !selectedTenant ? (
            <p className="text-sm text-neutral-500 px-6">Pilih atau buat tenant terlebih dahulu untuk melihat daftar device.</p>
          ) : devices.length === 0 ? (
            <p className="text-sm text-neutral-500 px-6">Belum ada device. Buat site terlebih dahulu bila belum ada.</p>
          ) : filteredDevices.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm text-neutral-500">Tidak ada perangkat pada child node (site) ini.</p>
              <Button variant="outline" size="sm" onClick={() => setSelectedSiteFilter("ALL")}>
                Tampilkan Semua Perangkat
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device Key</TableHead>
                  <TableHead>Nama / Deskripsi</TableHead>
                  <TableHead>Child Node (Site)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium">{device.device_key}</TableCell>
                    <TableCell>{device.name}</TableCell>
                    <TableCell>{siteNameById(device.site_id)}</TableCell>
                    <TableCell>
                      {!device.is_active ? (
                        <StatusPulse status="nonaktif" />
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {(() => {
                            const st = deviceStatuses[device.device_key];
                            if (st?.status === "online") return <StatusPulse status="online" />;
                            // terhubung ke broker tapi belum ada angka (mis. sensor belum terpasang)
                            if (st?.connection === "connected") return <StatusPulse status="stale" label="terhubung" />;
                            return <StatusPulse status="offline" />;
                          })()}
                          {deviceStatuses[device.device_key]?.last_seen && (
                            <span className="text-[10px] text-neutral-400">
                              data {formatTimeAgo(deviceStatuses[device.device_key].last_seen)}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        <MqttSetupDialog
                          device={device}
                          site={sites.find((s) => s.id === device.site_id)}
                          tenantSlug={selectedTenant?.slug}
                        />
                        <RoleGate allow={["superadmin", "tenant_admin", "operator"]}>
                          <Button
                            variant="outline"
                            size="sm"
                            title={
                              device.has_credential
                                ? "Kredensial sudah dibuat. Gunakan Reset / Forgot Password jika lupa."
                                : "Generate Kunci / Secret MQTT"
                            }
                            disabled={Boolean(device.has_credential) || provisioningId === device.id}
                            className={
                              device.has_credential
                                ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed opacity-60 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700"
                                : undefined
                            }
                            onClick={() => handleProvision(device, false)}
                          >
                            {provisioningId === device.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <KeyRound className="w-4 h-4" />
                            )}
                          </Button>
                          {device.has_credential && (
                            <Button
                              variant="outline"
                              size="sm"
                              title="Forgot / Reset Password MQTT"
                              disabled={provisioningId === device.id}
                              onClick={() => setResetTargetDevice(device)}
                            >
                              <RotateCcw className="w-4 h-4 text-amber-600" />
                            </Button>
                          )}
                        </RoleGate>
                        <Button variant="outline" size="sm" onClick={() => toggleActive(device)}>
                          {device.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                        <RoleGate allow={["superadmin", "tenant_admin"]}>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(device)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </RoleGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CredentialResultDialog credential={credential} onClose={() => setCredential(null)} />

      <Dialog open={!!resetTargetDevice} onOpenChange={(v) => !v && setResetTargetDevice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset / Forgot Password MQTT</DialogTitle>
            <DialogDescription className="text-amber-600 dark:text-amber-400">
              Peringatan: Password MQTT lama untuk device{" "}
              <strong>{resetTargetDevice?.device_key}</strong> akan langsung hangus. Perangkat di lapangan tidak akan bisa terkoneksi sebelum password barunya diperbarui.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTargetDevice(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={!resetTargetDevice || provisioningId === resetTargetDevice?.id}
              onClick={() => resetTargetDevice && handleProvision(resetTargetDevice, true)}
            >
              {provisioningId === resetTargetDevice?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : null}
              Ya, Reset Password MQTT
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function DevicesPage() {
  return (
    <RoleGate allow={["superadmin", "tenant_admin", "operator", "viewer"]}>
      <Suspense fallback={<p className="text-sm text-neutral-500 p-6">Memuat perangkat...</p>}>
        <DevicesPageContent />
      </Suspense>
    </RoleGate>
  );
}

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
import { ApiRequestError, devicesApi, sitesApi } from "@/lib/api-client";
import type { Device, DeviceCredential, Site } from "@/lib/types";
import { Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
      toast.error("Pilih tenant terlebih dahulu");
      return;
    }
    if (!siteId) {
      toast.error("Pilih site terlebih dahulu");
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
          <DialogTitle>Buat Device Baru</DialogTitle>
          <DialogDescription>device_key unik di dalam tenant yang sedang aktif.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Site</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih site" />
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
              placeholder="gw-01"
              required
              pattern="^[a-zA-Z0-9_-]+$"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Gateway 1" required />
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
  const [devices, setDevices] = useState<Device[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [credential, setCredential] = useState<DeviceCredential | null>(null);
  const [provisioningId, setProvisioningId] = useState<string | null>(null);

  const siteNameById = (id: string) => sites.find((s) => s.id === id)?.name ?? id;

  const load = useCallback(async () => {
    if (isSuperadmin && !selectedTenant) return;
    setLoading(true);
    try {
      const [allDevices, allSites] = await Promise.all([devicesApi.list(), sitesApi.list()]);
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
  }, [load]);

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

  const handleProvision = async (device: Device) => {
    setProvisioningId(device.id);
    try {
      const result = await devicesApi.provisionCredentials(device.id);
      setCredential(result);
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal provisioning kredensial");
    } finally {
      setProvisioningId(null);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <DashboardBreadcrumb title="DEVICES" text="Devices" />
        <div className="flex items-center gap-3">
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
          ) : devices.length === 0 ? (
            <p className="text-sm text-neutral-500 px-6">Belum ada device. Buat site terlebih dahulu bila belum ada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device Key</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium">{device.device_key}</TableCell>
                    <TableCell>{device.name}</TableCell>
                    <TableCell>{siteNameById(device.site_id)}</TableCell>
                    <TableCell>
                      <Badge className={device.is_active ? "bg-green-600 text-white" : "bg-neutral-400 text-white"}>
                        {device.is_active ? "aktif" : "nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <RoleGate allow={["superadmin", "tenant_admin", "operator"]}>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={provisioningId === device.id}
                            onClick={() => handleProvision(device)}
                          >
                            {provisioningId === device.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <KeyRound className="w-4 h-4" />
                            )}
                          </Button>
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
    </>
  );
}

export default function DevicesPage() {
  return (
    <RoleGate allow={["superadmin", "tenant_admin", "operator", "viewer"]}>
      <DevicesPageContent />
    </RoleGate>
  );
}

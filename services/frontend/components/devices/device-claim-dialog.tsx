"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { devicesApi, sitesApi, tenantsApi } from "@/lib/api-client";
import type { Device, Site, Tenant } from "@/lib/types";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { RadioTower, Server, ShieldAlert } from "lucide-react";

export function DeviceClaimDialog() {
  const { data: session } = useSession();
  const isSuperadmin = session?.user?.role === "superadmin";

  const [pendingDevices, setPendingDevices] = useState<Device[]>([]);
  const [currentDevice, setCurrentDevice] = useState<Device | null>(null);
  const [open, setOpen] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Fetch pending devices periodically or on load
  const checkPendingDevices = async () => {
    try {
      const list = await devicesApi.listPending();
      setPendingDevices(list);
      if (list.length > 0 && !open) {
        const nextDev = list[0];
        setCurrentDevice(nextDev);
        setName(nextDev.name.replace("New Device (", "").replace(")", ""));
        setSelectedTenantId(nextDev.tenant_id || "");
        setSelectedSiteId(nextDev.site_id || "");
        setOpen(true);
      }
    } catch {
      // Ignore background fetch error
    }
  };

  useEffect(() => {
    checkPendingDevices();
    const interval = setInterval(checkPendingDevices, 30000); // Check every 30s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 2. Fetch tenants if superadmin
  useEffect(() => {
    if (isSuperadmin) {
      tenantsApi.list().then(setTenants).catch(() => {});
    }
  }, [isSuperadmin]);

  // 3. Fetch sites
  useEffect(() => {
    sitesApi.list().then(setSites).catch(() => {});
  }, []);

  // Filter sites by selected tenant if superadmin
  const availableSites = isSuperadmin
    ? sites.filter((s) => !selectedTenantId || s.tenant_id === selectedTenantId)
    : sites;

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDevice) return;
    if (!selectedSiteId) {
      toast.error("Pilih lokasi site untuk device ini!");
      return;
    }

    setLoading(true);
    try {
      await devicesApi.claim(currentDevice.id, {
        name: name.trim() || currentDevice.device_key,
        site_id: selectedSiteId,
        tenant_id: isSuperadmin ? selectedTenantId : undefined,
      });

      toast.success(`Device ${currentDevice.device_key} berhasil diklaim & diaktifkan!`);
      
      // Lanjut ke pending device berikutnya jika ada
      const remaining = pendingDevices.filter((d) => d.id !== currentDevice.id);
      setPendingDevices(remaining);
      if (remaining.length > 0) {
        const nextDev = remaining[0];
        setCurrentDevice(nextDev);
        setName(nextDev.name.replace("New Device (", "").replace(")", ""));
        setSelectedTenantId(nextDev.tenant_id || "");
        setSelectedSiteId(nextDev.site_id || "");
      } else {
        setOpen(false);
        setCurrentDevice(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengklaim device";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!currentDevice) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-500 font-semibold mb-1">
            <RadioTower className="w-5 h-5 animate-pulse" />
            <span>Deteksi Device Baru</span>
          </div>
          <DialogTitle className="text-lg">Konfirmasi Kepemilikan Device</DialogTitle>
          <DialogDescription>
            Gateway mendeteksi unit device baru{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono font-bold">
              {currentDevice.device_key}
            </code>
            . Lengkapi informasi berikut untuk mengaktifkan pemantauan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleClaim} className="space-y-4 py-2">
          {/* Device Key Display */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Device Key (Hardware ID)</Label>
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/60 text-sm font-mono">
              <Server className="w-4 h-4 text-muted-foreground" />
              <span>{currentDevice.device_key}</span>
            </div>
          </div>

          {/* Device Name Input */}
          <div className="space-y-1.5">
            <Label htmlFor="dev-name">Nama Display Device</Label>
            <Input
              id="dev-name"
              placeholder="Contoh: Inverter Rooftop 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Pertanyaan 1: Device Milik Siapa? (Hanya Superadmin) */}
          {isSuperadmin && (
            <div className="space-y-1.5">
              <Label htmlFor="tenant-select" className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-primary" />
                <span>Device Milik Tenant Siapa?</span>
              </Label>
              <Select
                value={selectedTenantId}
                onValueChange={(val) => {
                  setSelectedTenantId(val);
                  setSelectedSiteId(""); // Reset site saat tenant ganti
                }}
              >
                <SelectTrigger id="tenant-select">
                  <SelectValue placeholder="Pilih Tenant Pemilik..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Pertanyaan 2: Lokasi Dimana? (Untuk Superadmin & User Tenant) */}
          <div className="space-y-1.5">
            <Label htmlFor="site-select">
              <span>Lokasi Penempatan Dimana? (Site)</span>
            </Label>
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId} required>
              <SelectTrigger id="site-select">
                <SelectValue placeholder="Pilih Lokasi Site..." />
              </SelectTrigger>
              <SelectContent>
                {availableSites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Nanti Saja
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Klaim & Aktifkan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

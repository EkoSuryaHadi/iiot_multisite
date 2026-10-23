"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Copy, HelpCircle, Terminal } from "lucide-react";
import type { Device, Site } from "@/lib/types";
import toast from "react-hot-toast";

export function MqttSetupDialog({
  device,
  site,
  tenantSlug,
}: {
  device: Device;
  site?: Site;
  tenantSlug?: string;
}) {
  const [copiedTopic, setCopiedTopic] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const effectiveTenant = tenantSlug || "{tenant_slug}";
  const effectiveSite = site?.slug || "{site_slug}";
  const topic = `telemetry/${effectiveTenant}/${effectiveSite}/${device.device_key}`;

  const samplePayload = JSON.stringify(
    {
      ts: new Date().toISOString(),
      metrics: {
        temperature: 28.5,
        humidity: 62.0,
        voltage: 220.4,
        status: 1,
      },
    },
    null,
    2
  );

  const handleCopy = (text: string, type: "topic" | "payload") => {
    navigator.clipboard.writeText(text);
    if (type === "topic") {
      setCopiedTopic(true);
      setTimeout(() => setCopiedTopic(false), 2000);
      toast.success("Topic MQTT berhasil disalin");
    } else {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
      toast.success("Contoh payload JSON berhasil disalin");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 gap-1 text-xs border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
          title="Panduan Koneksi MQTT"
        >
          <HelpCircle className="size-3.5 text-blue-500" />
          <span className="hidden md:inline">Setup MQTT</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Terminal className="size-5 text-primary" />
            Panduan Koneksi MQTT & Telemetry
          </DialogTitle>
          <DialogDescription className="text-xs">
            Konfigurasi koneksi perangkat <strong>{device.name}</strong> ({device.device_key}) ke broker MQTT EMQX.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Info Koneksi Broker */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
            <h6 className="font-semibold text-neutral-800 dark:text-neutral-200">1. Parameter Broker MQTT</h6>
            <div className="grid grid-cols-2 gap-2 text-neutral-600 dark:text-neutral-400">
              <div>
                <span className="text-neutral-400 block text-[11px]">Protokol & Port TCP</span>
                <span className="font-mono text-neutral-800 dark:text-neutral-200">mqtt:// (Port 1883)</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[11px]">WebSocket (WSS)</span>
                <span className="font-mono text-neutral-800 dark:text-neutral-200">wss:// (Port 8084)</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[11px]">Client ID / Username</span>
                <span className="font-mono text-neutral-800 dark:text-neutral-200">{device.device_key}</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[11px]">Password</span>
                <span className="italic text-neutral-500">Gunakan Secret dari tombol Kunci</span>
              </div>
            </div>
          </div>

          {/* MQTT Topic */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h6 className="font-semibold text-neutral-800 dark:text-neutral-200">2. Topic Publikasi Telemetry</h6>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(topic, "topic")}
                className="h-6 px-2 text-[11px] text-primary hover:text-primary gap-1"
              >
                {copiedTopic ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                {copiedTopic ? "Tersalin" : "Salin Topic"}
              </Button>
            </div>
            <pre className="bg-slate-900 text-emerald-400 p-2.5 rounded-md font-mono text-xs overflow-x-auto select-all">
              {topic}
            </pre>
          </div>

          {/* Sample JSON Payload */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h6 className="font-semibold text-neutral-800 dark:text-neutral-200">3. Format Payload JSON</h6>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(samplePayload, "payload")}
                className="h-6 px-2 text-[11px] text-primary hover:text-primary gap-1"
              >
                {copiedPayload ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                {copiedPayload ? "Tersalin" : "Salin JSON"}
              </Button>
            </div>
            <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-md font-mono text-xs overflow-x-auto select-all">
              {samplePayload}
            </pre>
            <p className="text-[11px] text-neutral-500">
              * Key metrik di dalam objek <code>metrics</code> bersifat dinamis (e.g. temperature, voltage, speed) dan akan otomatis diagregasi oleh ClickHouse.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

#!/usr/bin/env python3
"""Simulator device IoT sederhana memakai paho-mqtt.

Device terhubung ke EMQX (langsung atau via load balancer HAProxy) memakai
kredensial MQTT hasil provisioning dari Device & User Management API
(`POST /devices/{id}/credentials`), lalu secara periodik publish:
  - t/{tenant}/s/{site}/d/{device}/status    -> {"status": "online"|"offline"}
  - t/{tenant}/s/{site}/d/{device}/telemetry -> {"temp": .., "humidity": ..}

Device juga subscribe ke topik `cmd` miliknya sendiri dan mencetak perintah
yang diterima (mensimulasikan device yang bisa dikontrol dari dashboard).

Contoh pemakaian:
    python simulate_device.py \\
        --host localhost --port 1883 \\
        --tenant-slug mitra --site-slug jkt --device-key gw-01 \\
        --client-id mitra-jkt-gw-01 --password <password-hasil-provisioning> \\
        --interval 5 --count 10
"""
import argparse
import json
import random
import signal
import sys
import time

import paho.mqtt.client as mqtt


def build_topic(tenant_slug: str, site_slug: str, device_key: str, suffix: str) -> str:
    return f"t/{tenant_slug}/s/{site_slug}/d/{device_key}/{suffix}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--host", default="localhost", help="Host broker MQTT (EMQX / HAProxy)")
    parser.add_argument("--port", type=int, default=1883)
    parser.add_argument("--tenant-slug", required=True)
    parser.add_argument("--site-slug", required=True)
    parser.add_argument("--device-key", required=True)
    parser.add_argument("--client-id", required=True, help="client_id hasil provisioning (biasanya tenant-site-device)")
    parser.add_argument("--username", default=None, help="Default sama dengan --client-id")
    parser.add_argument("--password", required=True)
    parser.add_argument("--interval", type=float, default=5.0, help="Jeda antar publish telemetry (detik)")
    parser.add_argument("--count", type=int, default=0, help="Jumlah telemetry yang dikirim (0 = tanpa henti)")
    parser.add_argument("--keepalive", type=int, default=30)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    username = args.username or args.client_id

    status_topic = build_topic(args.tenant_slug, args.site_slug, args.device_key, "status")
    telemetry_topic = build_topic(args.tenant_slug, args.site_slug, args.device_key, "telemetry")
    cmd_topic = build_topic(args.tenant_slug, args.site_slug, args.device_key, "cmd")

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=args.client_id)
    client.username_pw_set(username, args.password)
    client.will_set(status_topic, json.dumps({"status": "offline"}), qos=1, retain=False)

    connected = {"ok": False}

    def on_connect(client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            connected["ok"] = True
            print(f"[simulator] terhubung sebagai '{username}' (reason_code={reason_code})")
            client.subscribe(cmd_topic)
            client.publish(status_topic, json.dumps({"status": "online"}), qos=1)
        else:
            print(f"[simulator] GAGAL konek: reason_code={reason_code}", file=sys.stderr)

    def on_disconnect(client, userdata, flags, reason_code, properties):
        print(f"[simulator] terputus (reason_code={reason_code})")

    def on_message(client, userdata, msg):
        print(f"[simulator] menerima perintah di '{msg.topic}': {msg.payload.decode(errors='replace')}")

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message

    client.connect(args.host, args.port, keepalive=args.keepalive)
    client.loop_start()

    deadline = time.time() + 10
    while not connected["ok"] and time.time() < deadline:
        time.sleep(0.2)

    if not connected["ok"]:
        print("[simulator] tidak berhasil terhubung dalam 10 detik, keluar.", file=sys.stderr)
        client.loop_stop()
        return 1

    stop = {"flag": False}

    def _handle_sigint(signum, frame):
        stop["flag"] = True

    signal.signal(signal.SIGINT, _handle_sigint)
    signal.signal(signal.SIGTERM, _handle_sigint)

    sent = 0
    try:
        while not stop["flag"] and (args.count == 0 or sent < args.count):
            payload = {
                "temp": round(20 + random.uniform(-3, 5), 2),
                "humidity": round(50 + random.uniform(-10, 10), 2),
            }
            client.publish(telemetry_topic, json.dumps(payload), qos=0)
            print(f"[simulator] publish telemetry -> {telemetry_topic}: {payload}")
            sent += 1
            time.sleep(args.interval)
    finally:
        client.publish(status_topic, json.dumps({"status": "offline"}), qos=1)
        time.sleep(0.3)
        client.loop_stop()
        client.disconnect()
        print(f"[simulator] selesai, total {sent} telemetry terkirim.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

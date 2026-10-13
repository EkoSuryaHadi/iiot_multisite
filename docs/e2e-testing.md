# Integrasi E2E (Fase 7)

## Simulator device

`tools/simulator/simulate_device.py` mensimulasikan satu device MQTT yang publish
telemetry & status secara periodik, dan subscribe ke topik `cmd` miliknya sendiri.

```bash
make simulate TENANT=mitra SITE=jkt DEVICE=gw-01 \
  CLIENT_ID=mitra-jkt-gw-01 PASSWORD=<password-hasil-provisioning> \
  INTERVAL=5 COUNT=20
```

Atau langsung lewat Docker:

```bash
docker build -t iiot-simulator ./tools/simulator
docker run --rm --network multisite_iiot_management_iiot-net iiot-simulator \
  --host haproxy --port 1883 \
  --tenant-slug mitra --site-slug jkt --device-key gw-01 \
  --client-id mitra-jkt-gw-01 --password <password> \
  --interval 5 --count 20
```

## Tes E2E otomatis

`tests/e2e/` berisi suite pytest yang dijalankan terhadap stack `docker compose up -d`
yang sungguhan berjalan (bukan mock). Mencakup:

- `test_full_pipeline.py`: alur penuh buat tenant -> site -> device -> provisioning
  kredensial -> koneksi MQTT -> publish telemetry & status -> query `analytics-api`
  (`/telemetry`, `/devices/status`, `/summary/tenant`) dan memastikan data konsisten
  end-to-end.
- `test_acl_negative.py`: tes ACL negatif -
  - device tenant A publish ke topik tenant B -> harus di-disconnect oleh EMQX
    (`auth-webhook` authz deny).
  - koneksi dengan password salah -> `CONNACK` gagal.
  - user dashboard tenant A query `analytics-api` tidak bisa melihat data tenant lain.

Setiap tes membuat tenant/site/device sendiri dengan slug unik (`uuid4`) dan
membersihkannya (`DELETE /tenants/{id}`) setelah selesai, sehingga aman dijalankan
berulang kali tanpa bentrok data.

### Menjalankan

Prasyarat: `docker compose up -d` dan superadmin sudah ada (lihat
`services/device-mgmt/app/bootstrap.py`).

```bash
make e2e
```

Variabel environment opsional (default mengasumsikan akses dari host lewat port yang
dipetakan di `.env`):

| Variabel | Default |
|---|---|
| `DEVICE_MGMT_URL` | `http://localhost:8001` |
| `ANALYTICS_API_URL` | `http://localhost:8003` |
| `MQTT_HOST` | `localhost` |
| `MQTT_PORT` | `1883` |
| `SUPERADMIN_EMAIL` | `itdev@gaungnusa.com` |
| `SUPERADMIN_PASSWORD` | `dolphin` |

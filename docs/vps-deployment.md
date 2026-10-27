# Panduan Deployment Produksi di Single VPS

Dokumen ini menjelaskan langkah demi langkah cara men-deploy **IIoT Multisite Management Platform** ke Single VPS menggunakan `docker-compose.prod.yml` dan **Caddy** (otomatis HTTPS Let's Encrypt).

---

## 1. Spesifikasi Minimum VPS yang Disarankan

Dengan konfigurasi Single-VPS (`docker-compose.prod.yml` menggunakan 1 node EMQX + batasan memori per container):
- **CPU**: Minimal 2 vCPU (disarankan 4 vCPU)
- **RAM**: Minimal 4 GB RAM (total batas memori seluruh container ~5.2 GB, pemakaian idle ~1.8–2.5 GB)
- **Storage**: Minimal 40 GB SSD/NVMe (data telemetry di ClickHouse memiliki TTL otomatis 180 hari untuk raw data dan 2 tahun untuk agregat `1m`/`1h`)
- **OS**: Ubuntu 22.04 LTS / 24.04 LTS atau Debian 12

---

## 2. Persiapan Firewall VPS (UFW)

Hanya port berikut yang perlu dibuka ke publik di VPS:
- `22/tcp` (SSH)
- `80/tcp` & `443/tcp` & `443/udp` (HTTP/HTTPS Caddy untuk Dashboard Web)
- `1883/tcp` (dan/atau `8883/tcp` untuk koneksi MQTT Gateway/Device)
- `3306/tcp` (Akses langsung Remote Database MySQL untuk Klien)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw allow 1883/tcp
sudo ufw allow 3306/tcp comment "MySQL Remote Access for Client"
sudo ufw enable
```

> **Catatan Keamanan Docker**: Di `docker-compose.prod.yml`, database internal (`postgres`, `clickhouse`) serta API internal (`device-mgmt`, `auth-webhook`, `analytics-api`) **tidak mempublikasikan port ke host (`0.0.0.0`)**, melainkan hanya berkomunikasi di dalam jaringan internal `iiot-net`. Port `3306` dipublikasikan khusus untuk akses klien terautentikasi (`andreas.nugroho@gaungnusa.com`). Dashboard EMQX (`18083`) hanya di-bind ke `127.0.0.1:18083`.

---

## 3. Generate File `.env` Produksi

Jangan pernah menggunakan password bawaan `change_me_*` di VPS! Gunakan script generator yang sudah disediakan untuk menghasilkan secret kriptografis acak (256-bit):

```bash
# Contoh jika sudah memiliki domain yang diarahkan (A record) ke IP VPS:
python3 tools/generate_prod_env.py --domain iot.perusahaan.com --email admin@perusahaan.com --output .env

# Contoh jika sementara masih mengakses lewat IP publik VPS (HTTP port 80):
python3 tools/generate_prod_env.py --domain :80 --email admin@perusahaan.com --output .env
```

Jika Anda mengakses via IP VPS (tanpa domain), sesuaikan `NEXTAUTH_URL` di `.env` menjadi `http://<IP_PUBLIK_VPS>`.
Catat nilai `SUPERADMIN_EMAIL` dan `SUPERADMIN_PASSWORD` yang ter-generate di dalam file `.env`.

---

## 4. Menjalankan Stack Produksi

1. **Build dan jalankan seluruh container**:
   ```bash
   make prod-up
   # atau: docker compose -f docker-compose.prod.yml up -d --build
   ```

2. **Periksa status kesehatan seluruh service**:
   ```bash
   make prod-ps
   ```
   Pastikan semua container berstatus `Up (healthy)` dan `iiot-emqx-bootstrap` selesai dengan `Exited (0)`.

3. **Bootstrap akun Superadmin pertama**:
   ```bash
   make prod-bootstrap
   # atau: docker compose -f docker-compose.prod.yml exec device-mgmt python -m app.bootstrap
   ```

4. **Akses Dashboard Web**:
   Buka `https://iot.perusahaan.com` (atau `http://<IP_VPS>`) di browser dan login menggunakan `SUPERADMIN_EMAIL` dan `SUPERADMIN_PASSWORD` dari file `.env`.

---

## 5. Mengakses EMQX Dashboard secara Aman (SSH Tunnel)

Karena port `18083` di-bind ke `127.0.0.1` di VPS demi keamanan, Anda dapat membukanya dari laptop lokal menggunakan SSH Local Port Forwarding:

```bash
ssh -L 18083:127.0.0.1:18083 user@<IP_VPS>
```

Lalu buka `http://localhost:18083` di browser lokal Anda dan login menggunakan `EMQX_DASHBOARD_USER` & `EMQX_DASHBOARD_PASSWORD` dari `.env`.

---

## 6. Operasional & Backup

- **Melihat Log Produksi**:
  ```bash
  make prod-logs
  ```
- **Backup Database PostgreSQL (Metadata Tenant, Site, User, Device)**:
  ```bash
  docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U iiot -d iiot > backup_postgres_$(date +%F).sql
  ```

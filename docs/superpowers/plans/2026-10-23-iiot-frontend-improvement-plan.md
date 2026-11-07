# IIoT Multi-Site Frontend Overhaul & Feature Roadmap (Tahap 1 - Tahap 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghapus seluruh artefak dan kode sisa template WowDash pada frontend, mengkonsolidasi arsitektur komponen, serta membangun fitur operasional Industrial IoT mutakhir (Real-Time Auto-Refresh, Status Pulse, Industrial Gauge, Panduan MQTT, Alerting System, Multi-Site Map, dan Export Data).

**Architecture:**
Frontend Next.js (App Router) dibersihkan dari template debt. Lapisan layout dikonsolidasi ke `components/layout/`. Komponen dashboard dan telemetry diperkaya dengan state auto-refresh dan visualisasi industrial widget (Radial Gauge). Backend-For-Frontend (BFF) diperluas untuk mendukung streaming/polling alarm dan ekspor data ClickHouse.

**Architecture Diagram:**

```mermaid
graph TD
    subgraph Frontend Next.js Client
        UI_Layout[Layout & Clean Header / Sidebar]
        AutoRefresh[Auto-Refresh Engine & Interval Polling]
        Widgets[Industrial Widgets: Gauges, Charts, Live Pulse]
        AlertUI[Active Alarm Notification Dropdown]
        SiteMap[Multi-Site Map & Device Quick Setup Modal]
    end

    subgraph BFF API Routes
        BFF_Analytics[/api/bff/analytics/*]
        BFF_DeviceMgmt[/api/bff/device-mgmt/*]
        BFF_Export[/api/bff/export/csv]
    end

    subgraph Backend Services
        AnalyticsAPI[analytics-api / ClickHouse]
        DeviceMgmt[device-mgmt / PostgreSQL]
        EMQX[EMQX Broker / MQTT]
    end

    UI_Layout --> AutoRefresh
    AutoRefresh --> Widgets
    Widgets --> BFF_Analytics
    AlertUI --> BFF_Analytics
    SiteMap --> BFF_DeviceMgmt
    BFF_Analytics --> AnalyticsAPI
    BFF_DeviceMgmt --> DeviceMgmt
    BFF_Export --> AnalyticsAPI
```

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Radix UI / Shadcn, Lucide React, ApexCharts, NextAuth.js.

**Spec:** Analisis menyeluruh arsitektur frontend IIoT Multi-Site dan perbaikan sisa template WowDash.

## Global Constraints
- Framework: Next.js App Router (TypeScript, Strict mode).
- CSS: Tailwind CSS v4 dengan utility class standar (hindari arbitrary class jika ada shorthand).
- Tidak boleh ada dead links (`href="#"`), placeholder vendor (WowDash, ThemeForest), atau mock data tanpa integrasi nyata.
- Komponen harus mendukung mode responsif (Mobile, Tablet, Desktop) serta Dark/Light Mode.

---

## TAHAP 1: Pembersihan Template & Refactoring Arsitektur (Technical Debt Removal)

### Task 1.1: Hapus Floating Theme Customizer & Link ThemeForest
Menghilangkan tombol melayang roda gigi (`Settings animate-spin`) dan drawer kustomisasi tema yang berisi link pembelian *"Purchase Now"* ThemeForest WowDash.

**Files:**
- Modify: `services/frontend/app/client-root.tsx:6,42`
- Remove / Modify: `services/frontend/components/theme-customizer/theme-customizer.tsx`

- [x] **Step 1: Hapus import dan pemanggilan ThemeCustomizer di `client-root.tsx`**
Hapus baris `import ThemeCustomizer from "@/components/theme-customizer/theme-customizer";` dan tag `<ThemeCustomizer />` di `client-root.tsx`.

- [x] **Step 2: Bersihkan folder `components/theme-customizer/`**
Hapus direktori `services/frontend/components/theme-customizer` karena fungsi Dark/Light mode sudah ditangani langsung oleh `<ModeToggle />` di Header.

- [x] **Step 3: Verifikasi di browser**
Buka dashboard di browser, pastikan tidak ada lagi ikon roda gigi berputar di pojok kanan bawah.

---

### Task 1.2: Hapus Orphan Files & Mock Data Template
Menghapus file-file dummy template yang tidak pernah dipakai dan berpotensi menimbulkan kebingungan.

**Files:**
- Remove: `services/frontend/utils/db.ts` (Mock user `wowdash@gmail.com`)
- Remove: `services/frontend/contexts/email-sidebar-context.tsx` (Sisa template email app)
- Remove: `services/frontend/components/charts/sales-static-chart.tsx` (Sisa chart penjualan e-commerce)
- Remove: `services/frontend/public/assets/images/notification/profile-*.png` (Avatar orang asing dummy)

- [x] **Step 1: Hapus `services/frontend/utils/db.ts`**
- [x] **Step 2: Hapus `services/frontend/contexts/email-sidebar-context.tsx`**
- [x] **Step 3: Hapus `services/frontend/components/charts/sales-static-chart.tsx`**
- [x] **Step 4: Hapus file dummy gambar `public/assets/images/notification/`**
- [x] **Step 5: Verifikasi tidak ada import broken**
Jalankan pencarian grep untuk memastikan tidak ada file aktif yang mengimpor komponen yang dihapus.

---

### Task 1.3: Konsolidasi Header, Footer & Branding
Menyatukan komponen layout dan memperbarui hak cipta footer menjadi brand resmi sistem.

**Files:**
- Modify: `services/frontend/components/layout/footer.tsx`
- Remove: `services/frontend/components/shared/footer.tsx`
- Remove: `services/frontend/components/shared/header.tsx`
- Modify: `services/frontend/app/client-root.tsx:40` (Uncomment footer)

- [x] **Step 1: Update `components/layout/footer.tsx` dengan branding resmi**
Ganti teks *"Made by GaungNusa"* / *"WowDash"* menjadi nama platform IIoT Multi-site resmi dengan tahun dinamis.
- [x] **Step 2: Hapus file duplikat `components/shared/header.tsx` dan `components/shared/footer.tsx`**
- [x] **Step 3: Aktifkan Footer di `client-root.tsx`**
Hapus komentar pada line 40 `<Footer />` agar footer tampil rapi dan konsisten di bagian bawah layout.

---

### Task 1.4: Nonaktifkan LanguageSelect Dummy di Header
Menghilangkan dropdown bahasa mati (En, Bn, Ar) dari header sampai lokalisasi nyata (i18n) diimplementasikan.

**Files:**
- Modify: `services/frontend/components/layout/header.tsx`

- [x] **Step 1: Hapus `<LanguageSelect />` dari `components/layout/header.tsx`**
Hapus import dan elemen `<LanguageSelect />`.
- [x] **Step 2: Verifikasi Header**
Header sekarang hanya berisi elemen fungsional: Sidebar Trigger, Search Bar (Ctrl+K), Dark/Light Toggle, Notification Dropdown, dan User Profile Dropdown.

---

### Task 1.5: Pembersihan Layout CSS Bloat di `globals.css`
Memangkas aturan CSS `globals.css` yang khusus dibuat untuk layout template WowDash (`layout="boron"`, `layout="helium"`, dsb.).

**Files:**
- Modify: `services/frontend/app/globals.css:440-490`

- [x] **Step 1: Hapus selector CSS `html[layout="helium"]` dan `html[layout="boron"]`**
- [x] **Step 2: Simpan hanya styling dasar, tailwind directives, dan tokens tema**
- [x] **Step 3: Uji visual layout dashboard untuk memastikan tidak ada regresi tampilan**

---

## TAHAP 2: Pengalaman Operasional IIoT Real-Time (Operational UX)

### Task 2.1: Auto-Refresh Engine & Interval Switcher Dashboard
Memberikan kontrol kepada operator untuk memperbarui data telemetry dan status device secara otomatis tanpa perlu merefresh halaman manual.

**Files:**
- Create: `services/frontend/contexts/AutoRefreshContext.tsx`
- Create: `services/frontend/components/shared/auto-refresh-selector.tsx`
- Modify: `services/frontend/app/(dashboard)/(homes)/dashboard/page.tsx`
- Modify: `services/frontend/app/(dashboard)/(homes)/dashboard/components/stat-card.tsx`
- Modify: `services/frontend/app/(dashboard)/(homes)/dashboard/components/device-status-card.tsx`
- Modify: `services/frontend/app/(dashboard)/(homes)/dashboard/components/metrics-summary-card.tsx`

- [x] **Step 1: Buat context & hook `AutoRefreshContext`**
Menyediakan state interval (`0` / Off, `10000` / 10s, `30000` / 30s, `60000` / 60s, `300000` / 5m), countdown timer detik tersisa, dan fungsi trigger manual refresh `refreshNow()`.
- [x] **Step 2: Buat komponen UI `AutoRefreshSelector`**
Tombol dropdown di samping `TenantSelector` yang menampilkan status: *"Auto: 30s (15s)"* dan tombol manual *"Refresh"*.
- [x] **Step 3: Hubungkan trigger refresh ke `StatCard`, `DeviceStatusCard`, dan `MetricsSummaryCard`**
Saat interval terpicu atau tombol ditekan, cards secara otomatis fetch data terbaru dari `analyticsApi`.

---

### Task 2.2: Live Pulse Indicator & Device Heartbeat
Menampilkan indikator visual hidup/mati yang jelas dengan animasi pulse untuk status device.

**Files:**
- Create: `services/frontend/components/shared/status-pulse.tsx`
- Modify: `services/frontend/app/(dashboard)/(homes)/dashboard/components/device-status-card.tsx`
- Modify: `services/frontend/app/(dashboard)/devices/page.tsx`

- [x] **Step 1: Buat komponen `StatusPulse`**
```tsx
export function StatusPulse({ status }: { status: "online" | "offline" | "stale" })
```
Menampilkan titik lampu:
- Hijau berdenyut (`animate-ping`) untuk `online`.
- Abu-abu/merah padam untuk `offline`.
- Kuning untuk `stale`.
- [x] **Step 2: Terapkan `StatusPulse` di tabel status device dashboard dan tabel halaman Devices**
- [x] **Step 3: Tambahkan kolom kalkulasi durasi "Last Seen" (e.g., "Baru saja", "2 mnt lalu")**

---

### Task 2.3: Industrial Radial Bar / Gauge Widget
Menambahkan komponen visualisasi sensor berbentuk speedometer/gauge untuk parameter kritis (misal: Temperature, Pressure, Voltage, Current).

**Files:**
- Create: `services/frontend/components/charts/radial-gauge.tsx`
- Modify: `services/frontend/app/(dashboard)/telemetry/page.tsx`

- [x] **Step 1: Buat komponen `RadialGauge` menggunakan ApexCharts**
Mendukung rentang nilai minimum-maksimum, satuan unit (e.g. `°C`, `bar`, `V`, `A`), serta zona threshold (Hijau = Normal, Kuning = Warning, Merah = Critical).
- [x] **Step 2: Pasang di halaman Telemetry sebagai tampilan gauge meter berdampingan dengan grafik time-series**
- [x] **Step 3: Verifikasi responsivitas pada mobile dan desktop**

---

### Task 2.4: Modal Panduan Koneksi MQTT untuk Teknisi Lapangan
Menyediakan modal bantuan teknis pada setiap device untuk mempermudah teknisi/engineer menghubungkan hardware IoT ke broker EMQX.

**Files:**
- Create: `services/frontend/components/devices/mqtt-setup-dialog.tsx`
- Modify: `services/frontend/app/(dashboard)/devices/page.tsx`

- [x] **Step 1: Buat komponen `MqttSetupDialog`**
Menampilkan:
- Broker Host & Port (`mqtt://` Port 1883 / WSS Port 8084)
- Format Topic Publish: `telemetry/{tenant_slug}/{site_slug}/{device_key}`
- Format Contoh Payload JSON telemetry
- Tombol Copy Topic & Copy Format Payload sekali klik
- [x] **Step 2: Tambahkan tombol *"Setup MQTT"* di setiap baris tabel device**
- [x] **Step 3: Uji interaksi tombol copy ke clipboard dengan toast notification**

---

## TAHAP 3: Fitur Enterprise (Alarm, Map & Export)

### Task 3.1: Skema Threshold & Alarm Engine Sederhana
Mekanisme pendeteksian kondisi abnormal metrik sensor berdasarkan batasan ambang (threshold).

**Files:**
- Modify: `services/analytics-api/app/config.py` atau endpoint backend analytics
- Create: `services/frontend/lib/alarms.ts` (Evaluator threshold telemetry)
- Modify: `services/frontend/lib/types.ts` (Tambahkan tipe `AlarmEvent`)

- [x] **Step 1: Definisikan interface `AlarmEvent` dan status severity (`critical`, `warning`, `info`)**
- [x] **Step 2: Buat utilitas evaluasi metrik untuk mendeteksi deviasi nilai di atas batas toleransi**
- [x] **Step 3: Unit test evaluator dengan berbagai nilai sampel sensor**

---

### Task 3.2: Integrasi Notifikasi Aktif pada Dropdown Header
Menghubungkan icon lonceng di header dengan data alarm nyata jika terdeteksi metrik abnormal atau device offline.

**Files:**
- Modify: `services/frontend/components/shared/notification-dropdown.tsx`
- Modify: `services/frontend/contexts/TenantContext.tsx`

- [x] **Step 1: Hubungkan dropdown notifikasi dengan state alarm tenant aktif**
- [x] **Step 2: Tampilkan badge merah dengan counter jumlah alarm aktif pada icon Bell**
- [x] **Step 3: Render daftar insiden jika ada alarm (misal: "Device PUMP-01 Offline", "Suhu Sensor-2 > 80°C"), atau empty state jika normal**
- [x] **Step 4: Berikan link navigasi langsung dari notifikasi ke device terkait**

---

### Task 3.3: Interactive Multi-Site Map View
Visualisasi peta geografis lokasi seluruh Site dan status operasional perangkat per lokasi pabrik/site.

**Files:**
- Create: `services/frontend/components/sites/site-map-view.tsx`
- Modify: `services/frontend/app/(dashboard)/sites/page.tsx`
- Modify: `services/frontend/app/(dashboard)/(homes)/dashboard/page.tsx`

- [x] **Step 1: Buat komponen peta interaktif menggunakan SVG / Map component**
- [x] **Step 2: Hubungkan koordinat latitude & longitude dari data Site**
- [x] **Step 3: Tampilkan pin lokasi dengan status warna: Hijau jika semua device online, Merah jika ada device kritis**
- [x] **Step 4: Tambahkan popup informasi site saat pin diklik (Nama Site, Jumlah Device, Quick Link ke Devices)**

---

### Task 3.4: Fitur Ekspor Data Telemetry ke CSV
Memungkinkan operator dan manajemen mengunduh data riwayat metrik ClickHouse ke format spreadsheet CSV.

**Files:**
- Create: `services/frontend/app/api/bff/export/route.ts`
- Create: `services/frontend/components/telemetry/export-telemetry-dialog.tsx`
- Modify: `services/frontend/app/(dashboard)/telemetry/page.tsx`

- [x] **Step 1: Buat route handler API untuk memformat data ClickHouse menjadi CSV file stream**
- [x] **Step 2: Buat UI modal export dengan filter rentang tanggal (Start Date - End Date) dan pilihan metrik**
- [x] **Step 3: Pasang tombol *"Export CSV"* di header halaman Telemetry dengan status downloading**
- [x] **Step 4: Uji hasil file CSV yang diunduh untuk memastikan kompatibilitas format (RFC 4180)**

---

## Verifikasi & Kriteria Sukses Keseluruhan
1. **Zero Template Debt:** Tidak ada lagi mention "WowDash", link ThemeForest, "Purchase Now", avatar dummy, atau mock password di codebase.
2. **Industrial Grade UX:** Dashboard memiliki Auto-Refresh hidup, pulse device heartbeat, dan gauge meter yang responsif.
3. **Data Integrity:** Alur data dari ClickHouse & PostgreSQL tersaji akurat melalui BFF dengan isolasi multi-tenant yang aman.
4. **Build & Lint Clean:** `npm run build` dan type checking frontend berjalan sukses tanpa error.

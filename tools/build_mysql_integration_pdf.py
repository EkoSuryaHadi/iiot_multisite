import os
import subprocess

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUTPUT_HTML = r"e:\Project\iiot_multisite\panduan_integrasi_mysql_user.html"
OUTPUT_PDF = r"e:\Project\iiot_multisite\Panduan_Integrasi_MySQL_User_IIoT.pdf"

html_content = """<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Panduan & Spesifikasi Integrasi Forwarding Telemetri ke MySQL Klien</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 16mm 14mm 16mm 14mm;
      @bottom-right {
        content: "Halaman " counter(page);
        font-size: 8.5pt;
        color: #64748b;
      }
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.55;
      color: #1e293b;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .header-banner {
      border-bottom: 2.5px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-title h1 {
      font-size: 17pt;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px 0;
      letter-spacing: -0.3px;
    }
    .header-title p {
      margin: 0;
      color: #64748b;
      font-size: 9.5pt;
      font-weight: 500;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      font-size: 8.5pt;
    }
    .meta-item strong {
      display: block;
      color: #475569;
      font-size: 7.5pt;
      text-transform: uppercase;
      margin-bottom: 2px;
      letter-spacing: 0.4px;
    }
    .meta-item span {
      color: #0f172a;
      font-weight: 600;
    }
    h2 {
      font-size: 11.5pt;
      font-weight: 700;
      color: #0f172a;
      border-left: 3.5px solid #0284c7;
      padding-left: 8px;
      margin: 16px 0 8px 0;
    }
    h3 {
      font-size: 10pt;
      font-weight: 600;
      color: #334155;
      margin: 10px 0 4px 0;
    }
    p, li {
      color: #334155;
      margin: 0 0 6px 0;
    }
    ul, ol {
      margin: 0 0 10px 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 4px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .alert-info {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 10px 12px;
      border-radius: 4px;
      margin: 10px 0;
      font-size: 9pt;
      color: #1e40af;
    }
    .code-block {
      background: #0f172a;
      color: #e2e8f0;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 8.5pt;
      padding: 10px 12px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 8px 0 12px 0;
      line-height: 1.45;
    }
    .code-block .sql-kw {
      color: #38bdf8;
      font-weight: 600;
    }
    .code-block .sql-fn {
      color: #f472b6;
    }
    .code-block .sql-str {
      color: #4ade80;
    }
    .code-block .sql-com {
      color: #94a3b8;
      font-style: italic;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 8.5pt;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 9px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    .badge-code {
      font-family: 'Consolas', monospace;
      font-size: 8pt;
      background: #e2e8f0;
      padding: 2px 5px;
      border-radius: 3px;
      color: #0f172a;
    }
    .footer {
      margin-top: 24px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      font-size: 8pt;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>

  <div class="header-banner">
    <div class="header-title">
      <h1>Spesifikasi & Panduan Integrasi MySQL</h1>
      <p>Layanan Forwarding Telemetri Real-Time IIoT Multi-Site</p>
    </div>
    <div>
      <span class="badge">Technical Guide</span>
    </div>
  </div>

  <div class="meta-box">
    <div class="meta-item">
      <strong>Protokol Data</strong>
      <span>MySQL 8.0+ / MariaDB (TLS/SSL)</span>
    </div>
    <div class="meta-item">
      <strong>Metode Pengiriman</strong>
      <span>Real-Time Async Batch (2 Detik)</span>
    </div>
    <div class="meta-item">
      <strong>Format Skema</strong>
      <span>Long/EAV Series (Auto-DDL)</span>
    </div>
  </div>

  <h2>1. Ringkasan Integrasi</h2>
  <p>
    Dokumen ini memuat panduan bagi tim teknis/administrator database klien untuk mengaktifkan penerimaan data telemetri IIoT (Internet of Things) langsung ke server database MySQL Anda secara otomatis dan <em>near real-time</em>.
  </p>
  <div class="alert-info">
    <strong>Karakteristik Aliran Data:</strong> Sistem kami bertindak sebagai <em>client</em> yang mengalirkan data (INSERT only) menggunakan koneksi terenkripsi (TLS) setiap beberapa detik. Data yang dikirim adalah telemetri perangkat sensor yang terdaftar pada akun perusahaan Anda.
  </div>

  <h2>2. Persyaratan & Tindakan dari Sisi Klien</h2>
  <div class="card">
    <h3>Langkah 1: Whitelist Akses Jaringan (Firewall / Security Group)</h3>
    <p>
      Izinkan port MySQL Anda (default: <code>3306</code>) untuk dapat diakses oleh IP publik server kami:
    </p>
    <ul>
      <li><strong>IP Publik Server IIoT Kami:</strong> <code>[Silakan isi dengan IP Publik VPS Anda]</code></li>
    </ul>

    <h3>Langkah 2: Menyiapkan User & Hak Akses MySQL</h3>
    <p>
      Jalankan perintah SQL berikut di MySQL Anda untuk membuat database khusus dan user dengan hak akses minimal (least privilege):
    </p>
    <div class="code-block">
<span class="sql-kw">CREATE DATABASE IF NOT EXISTS</span> `iiot_telemetry` <span class="sql-kw">CHARACTER SET</span> utf8mb4 <span class="sql-kw">COLLATE</span> utf8mb4_unicode_ci;

<span class="sql-com">-- Ganti 'PasswordKuatAnda123!' dengan kata sandi yang aman</span>
<span class="sql-kw">CREATE USER</span> <span class="sql-str">'iiot_forwarder'</span>@<span class="sql-str">'%'</span> <span class="sql-kw">IDENTIFIED BY</span> <span class="sql-str">'PasswordKuatAnda123!'</span>;

<span class="sql-com">-- Berikan hak akses SELECT, INSERT, dan CREATE TABLE</span>
<span class="sql-kw">GRANT SELECT, INSERT, CREATE ON</span> `iiot_telemetry`.* <span class="sql-kw">TO</span> <span class="sql-str">'iiot_forwarder'</span>@<span class="sql-str">'%'</span>;
<span class="sql-kw">FLUSH PRIVILEGES</span>;
    </div>
    <p style="font-size: 8.5pt; color: #64748b;">
      <em>Catatan: Tanda <code>'%'</code> dapat diganti secara spesifik dengan IP publik server kami untuk keamanan ekstra.</em>
    </p>

    <h3>Langkah 3: Informasi yang Perlu Dikirimkan Balik ke Kami</h3>
    <p>Mohon kirimkan informasi berikut kepada tim kami agar integrasi dapat segera diaktifkan:</p>
    <ol>
      <li><strong>Host / IP / Domain MySQL:</strong> (Contoh: <code>db.perusahaan.com</code> atau <code>103.xxx.xxx.xxx</code>)</li>
      <li><strong>Port:</strong> (Contoh: <code>3306</code>)</li>
      <li><strong>Nama Database:</strong> (Contoh: <code>iiot_telemetry</code>)</li>
      <li><strong>Username:</strong> (Contoh: <code>iiot_forwarder</code>)</li>
      <li><strong>Password:</strong></li>
      <li><strong>Kebijakan SSL/TLS:</strong> Standar TLS / Wajib CA Certificate khusus</li>
    </ol>
  </div>

  <h2>3. Spesifikasi Struktur Tabel Data (Format Long Series)</h2>
  <p>
    Sistem kami akan secara otomatis membuat tabel target (default: <code>telemetry</code>) jika tabel belum tersedia:
  </p>
  <table>
    <thead>
      <tr>
        <th style="width: 18%;">Nama Kolom</th>
        <th style="width: 18%;">Tipe Data</th>
        <th style="width: 14%;">Indeks</th>
        <th>Deskripsi & Contoh Nilai</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>id</code></td>
        <td><code>BIGINT</code></td>
        <td><span class="badge-code">PRIMARY KEY</span></td>
        <td>ID unik auto-increment baris data.</td>
      </tr>
      <tr>
        <td><code>tenant_slug</code></td>
        <td><code>VARCHAR(64)</code></td>
        <td><span class="badge-code">INDEX</span></td>
        <td>Pengenal unik tenant/perusahaan Anda (misal: <code>mitratel</code>).</td>
      </tr>
      <tr>
        <td><code>site_slug</code></td>
        <td><code>VARCHAR(64)</code></td>
        <td><span class="badge-code">INDEX</span></td>
        <td>Kode lokasi atau site instalasi (misal: <code>site-jkt-01</code>).</td>
      </tr>
      <tr>
        <td><code>device_key</code></td>
        <td><code>VARCHAR(64)</code></td>
        <td><span class="badge-code">INDEX</span></td>
        <td>Nomor seri / identitas gateway IoT (misal: <code>gw-sps-01</code>).</td>
      </tr>
      <tr>
        <td><code>metric_name</code></td>
        <td><code>VARCHAR(64)</code></td>
        <td><span class="badge-code">INDEX</span></td>
        <td>Nama parameter/sensor: <code>v_pv</code>, <code>p_load</code>, <code>temp</code>, dll.</td>
      </tr>
      <tr>
        <td><code>metric_value</code></td>
        <td><code>DOUBLE</code></td>
        <td>-</td>
        <td>Nilai numerik pembacaan sensor (contoh: <code>54.20</code>, <code>28.5</code>).</td>
      </tr>
      <tr>
        <td><code>ts</code></td>
        <td><code>DATETIME(3)</code></td>
        <td><span class="badge-code">INDEX</span></td>
        <td>Timestamp presisi milidetik saat sensor membaca data (UTC).</td>
      </tr>
      <tr>
        <td><code>raw_payload</code></td>
        <td><code>TEXT</code></td>
        <td>-</td>
        <td>JSON string lengkap pesan asli dari perangkat untuk kebutuhan audit.</td>
      </tr>
      <tr>
        <td><code>created_at</code></td>
        <td><code>TIMESTAMP</code></td>
        <td>-</td>
        <td>Waktu saat baris data berhasil dimasukkan ke MySQL Anda.</td>
      </tr>
    </tbody>
  </table>

  <h2>4. Contoh Query Analisis Data</h2>
  <p>Format tabel ini sangat fleksibel untuk dihubungkan ke Metabase, PowerBI, Grafana, atau aplikasi internal Anda:</p>
  <div class="code-block">
<span class="sql-com">-- Contoh 1: Mengambil tren tegangan PV (v_pv) 1 jam terakhir pada site tertentu</span>
<span class="sql-kw">SELECT</span> `ts`, `device_key`, `metric_value` <span class="sql-kw">AS</span> `v_pv`
<span class="sql-kw">FROM</span> `telemetry`
<span class="sql-kw">WHERE</span> `site_slug` = <span class="sql-str">'site-jkt-01'</span>
  <span class="sql-kw">AND</span> `metric_name` = <span class="sql-str">'v_pv'</span>
  <span class="sql-kw">AND</span> `ts` >= <span class="sql-fn">NOW</span>() - <span class="sql-kw">INTERVAL</span> 1 <span class="sql-kw">HOUR</span>
<span class="sql-kw">ORDER BY</span> `ts` <span class="sql-kw">ASC</span>;

<span class="sql-com">-- Contoh 2: Menampilkan nilai terbaru dari seluruh metrik pada suatu perangkat</span>
<span class="sql-kw">SELECT</span> t1.`metric_name`, t1.`metric_value`, t1.`ts`
<span class="sql-kw">FROM</span> `telemetry` t1
<span class="sql-kw">INNER JOIN</span> (
    <span class="sql-kw">SELECT</span> `metric_name`, <span class="sql-fn">MAX</span>(`ts`) <span class="sql-kw">AS</span> max_ts
    <span class="sql-kw">FROM</span> `telemetry`
    <span class="sql-kw">WHERE</span> `device_key` = <span class="sql-str">'gw-sps-01'</span>
    <span class="sql-kw">GROUP BY</span> `metric_name`
) t2 <span class="sql-kw">ON</span> t1.`metric_name` = t2.`metric_name` <span class="sql-kw">AND</span> t1.`ts` = t2.max_ts
<span class="sql-kw">WHERE</span> t1.`device_key` = <span class="sql-str">'gw-sps-01'</span>;
  </div>

  <div class="footer">
    Dokumen Teknis Integrasi Platform IIoT &copy; 2026. Seluruh hak cipta dilindungi.
  </div>

</body>
</html>
"""

with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"HTML berhasil dibuat di: {OUTPUT_HTML}")

# Compile HTML to PDF via Headless Chrome
cmd = [
    CHROME_PATH,
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={OUTPUT_PDF}",
    OUTPUT_HTML,
]

res = subprocess.run(cmd, capture_output=True, text=True)
if res.returncode == 0:
    print(f"PDF berhasil di-generate di: {OUTPUT_PDF}")
else:
    print(f"Gagal generate PDF: {res.stderr}")


import os
import base64
import subprocess

IMAGE_DIR = r"C:/Users/USER/.gemini/antigravity/brain/32c732ec-9b1a-409b-a03e-6d9a1aef68ca/.user_uploaded"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUTPUT_HTML = r"e:\Project\iiot_multisite\panduan_perbaikan_usr_m100.html"
OUTPUT_PDF = r"e:\Project\iiot_multisite\Panduan_Perbaikan_dan_Konfigurasi_USR_M100.pdf"

def get_b64(filename):
    path = os.path.join(IMAGE_DIR, filename)
    with open(path, "rb") as f:
        data = f.read()
    return f"data:image/jpeg;base64,{base64.b64encode(data).decode('utf-8')}"

img1_b64 = get_b64("media_1794036035675_cbb93d5f.jpg")  # MQTT1
img2_b64 = get_b64("media_1794036035680_2b95753f.jpg")  # Data Report
img3_b64 = get_b64("media_1794036035714_b8c67104.jpg")  # Protocol conversion
img4_b64 = get_b64("media_1794036035719_164c04df.jpg")  # MQTT Client connection
img5_b64 = get_b64("media_1794036035712_ab2a4f5b.jpg")  # MQTT Client subscription

html_content = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Panduan Audit & Perbaikan Konfigurasi Gateway USR-M100</title>
  <style>
    @page {{
      size: A4 portrait;
      margin: 14mm 14mm 14mm 14mm;
      @bottom-right {{
        content: "Halaman " counter(page);
        font-size: 8.5pt;
        color: #64748b;
      }}
    }}
    * {{
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}
    body {{
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.5;
      color: #1e293b;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }}
    .header-banner {{
      border-bottom: 2px solid #2563eb;
      padding-bottom: 10px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }}
    .header-title h1 {{
      font-size: 17pt;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px 0;
      letter-spacing: -0.4px;
    }}
    .header-title p {{
      margin: 0;
      color: #64748b;
      font-size: 9.5pt;
      font-weight: 500;
    }}
    .badge {{
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}
    .badge-primary {{
      background: #dbeafe;
      color: #1e40af;
    }}
    .badge-danger {{
      background: #fee2e2;
      color: #991b1b;
    }}
    .badge-success {{
      background: #dcfce7;
      color: #166534;
    }}
    .badge-warning {{
      background: #fef3c7;
      color: #92400e;
    }}

    .callout {{
      border-radius: 6px;
      padding: 10px 14px;
      margin: 10px 0;
      font-size: 9pt;
      page-break-inside: avoid;
    }}
    .callout-info {{
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      color: #1e40af;
    }}
    .callout-warning {{
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      color: #92400e;
    }}
    .callout-danger {{
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      color: #991b1b;
    }}
    .callout-success {{
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
      color: #166534;
    }}

    h2 {{
      font-size: 12pt;
      font-weight: 700;
      color: #0f172a;
      border-left: 4px solid #2563eb;
      padding-left: 8px;
      margin-top: 18px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }}
    h3 {{
      font-size: 10.5pt;
      font-weight: 600;
      color: #334155;
      margin-top: 12px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }}

    table {{
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 12px 0;
      font-size: 8.8pt;
      page-break-inside: avoid;
    }}
    th, td {{
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }}
    th {{
      background: #f1f5f9;
      font-weight: 600;
      color: #1e293b;
    }}
    tr:nth-child(even) td {{
      background: #f8fafc;
    }}

    code {{
      font-family: Consolas, 'Courier New', monospace;
      font-size: 8.5pt;
      background: #f1f5f9;
      color: #0f172a;
      padding: 2px 4px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
      word-break: break-all;
    }}
    pre {{
      font-family: Consolas, 'Courier New', monospace;
      font-size: 8.5pt;
      background: #0f172a;
      color: #f8fafc;
      padding: 8px 12px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 8px 0;
      line-height: 1.4;
      page-break-inside: avoid;
    }}

    .screenshot-card {{
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      page-break-inside: avoid;
    }}
    .screenshot-flex {{
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }}
    .screenshot-img-col {{
      flex: 0 0 42%;
      max-width: 42%;
      text-align: center;
    }}
    .screenshot-img-col img {{
      max-width: 100%;
      max-height: 240px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 1px 2px rgba(0,0,0,0.08);
      object-fit: contain;
    }}
    .screenshot-desc-col {{
      flex: 1 1 58%;
    }}

    .tag-wrong {{
      color: #dc2626;
      font-weight: 600;
    }}
    .tag-ok {{
      color: #16a34a;
      font-weight: 600;
    }}

    .page-break {{
      page-break-before: always;
    }}

    .summary-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 10px 0;
      page-break-inside: avoid;
    }}
    .summary-box {{
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
      background: #f8fafc;
    }}
    .summary-box.alert-box {{
      border-left: 4px solid #ef4444;
      background: #fff5f5;
    }}
    .summary-box.fix-box {{
      border-left: 4px solid #22c55e;
      background: #f0fdf4;
    }}
  </style>
</head>
<body>

  <!-- HEADER BANNER -->
  <div class="header-banner">
    <div class="header-title">
      <h1>Panduan Audit & Perbaikan Konfigurasi USR-M100</h1>
      <p>Resolusi Integrasi Modbus Gateway ke Broker EMQX &bull; Platform IIoT Multisite</p>
    </div>
    <div>
      <span class="badge badge-primary">Technical Action Plan</span>
    </div>
  </div>

  <div class="callout callout-danger">
    <strong>Ringkasan Masalah Lapangan (Mockup Device: <code>GNIS_MockupUSR</code>):</strong><br>
    Pengujian saat ini mengalami kegagalan transmisi data akibat <strong>ketidaksesuaian Client ID</strong> pada gateway, <strong>kesalahan penamaan Report Topic</strong> yang ditolak oleh Webhook ACL, serta <strong>bentrok sesi (Client ID collision)</strong> antara software MQTT tester di PC dan hardware gateway fisik.
  </div>

  <h2>1. Audit Temuan Lapangan & Tindakan Perbaikan</h2>

  <!-- SCREEN 1 -->
  <div class="screenshot-card">
    <div class="screenshot-flex">
      <div class="screenshot-img-col">
        <img src="{img1_b64}" alt="USR MQTT1 Config">
        <p style="font-size: 7.5pt; color: #64748b; margin: 4px 0 0 0;">Screenshot 1: Web Management USR-M100 (Tab MQTT1)</p>
      </div>
      <div class="screenshot-desc-col">
        <h3 style="margin-top: 0; color: #0f172a;">Layar 1 &mdash; Tab "MQTT1" (Gateway USR-M100)</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 28%;">Parameter</th>
              <th style="width: 34%;">Status Saat Ini</th>
              <th>Perbaikan Yang Benar</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Client ID</strong></td>
              <td><span class="tag-wrong">GNIS_MockupUSR</span></td>
              <td><span class="tag-ok">solar-jkt-GNIS_MockupUSR</span><br><small style="color:#64748b;">Format: {{tenant}}-{{site}}-{{device_key}}</small></td>
            </tr>
            <tr>
              <td><strong>Clean up session</strong></td>
              <td><span class="tag-wrong">Unchecked (False)</span></td>
              <td><span class="tag-ok">Checked (True / Enable)</span></td>
            </tr>
            <tr>
              <td><strong>Server Address</strong></td>
              <td>38.47.180.128</td>
              <td><span class="tag-ok">38.47.180.128 (Sudah Benar)</span></td>
            </tr>
            <tr>
              <td><strong>Remote Port</strong></td>
              <td>1883</td>
              <td><span class="tag-ok">1883 (Sudah Benar)</span></td>
            </tr>
            <tr>
              <td><strong>Username / Pass</strong></td>
              <td>solar-jkt-GNIS_... / YX0...</td>
              <td><span class="tag-ok">Sudah Benar (Sesuai Provisioning)</span></td>
            </tr>
            <tr>
              <td><strong>SSL Protocol</strong></td>
              <td>Close</td>
              <td><span class="tag-ok">Close (Benar untuk port 1883)</span></td>
            </tr>
          </tbody>
        </table>
        <div style="font-size: 8pt; color: #475569;">
          <strong>Penyebab:</strong> EMQX Webhook Authenticator mengecek kecocokan identitas perangkat. Jika Client ID tidak mengandung format tenant-site-device, sesi koneksi tidak dapat dipetakan secara valid.
        </div>
      </div>
    </div>
  </div>

  <!-- SCREEN 2 -->
  <div class="screenshot-card">
    <div class="screenshot-flex">
      <div class="screenshot-img-col">
        <img src="{img2_b64}" alt="USR Data Report Config">
        <p style="font-size: 7.5pt; color: #64748b; margin: 4px 0 0 0;">Screenshot 2: Web Management USR-M100 (Data Report)</p>
      </div>
      <div class="screenshot-desc-col">
        <h3 style="margin-top: 0; color: #0f172a;">Layar 2 &mdash; Tab "Data Report" (Publikasi Telemetri)</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 28%;">Parameter</th>
              <th style="width: 34%;">Status Saat Ini</th>
              <th>Perbaikan Yang Benar</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Report Topic</strong></td>
              <td><span class="tag-wrong">/UpTopic_GNISMQTT</span></td>
              <td><span class="tag-ok">t/solar/s/jkt/d/GNIS_MockupUSR/telemetry</span></td>
            </tr>
            <tr>
              <td><strong>QOS</strong></td>
              <td>QOS0</td>
              <td><span class="tag-ok">QOS0 (Sudah Optimal)</span></td>
            </tr>
            <tr>
              <td><strong>Period Report</strong></td>
              <td>Checked (5 s)</td>
              <td><span class="tag-ok">Checked (5 s)</span></td>
            </tr>
            <tr>
              <td><strong>Report Template</strong></td>
              <td><span class="tag-wrong">Nested JSON acak</span></td>
              <td><span class="tag-ok">Format Metrik Standar (Lihat Bagian 2)</span></td>
            </tr>
          </tbody>
        </table>
        <div style="font-size: 8pt; color: #475569;">
          <strong>Penyebab:</strong> Topik <code>/UpTopic_GNISMQTT</code> <u>pasti ditolak</u> oleh Webhook ACL karena di luar otoritas device. EMQX Rule Engine juga tidak dapat mengalihkan data ke ClickHouse tanpa format topik hirarki standar.
        </div>
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- SCREEN 3 -->
  <div class="screenshot-card">
    <div class="screenshot-flex">
      <div class="screenshot-img-col">
        <img src="{img3_b64}" alt="USR Protocol Conversion">
        <p style="font-size: 7.5pt; color: #64748b; margin: 4px 0 0 0;">Screenshot 3: Edge Gateway (Protocol Conversion)</p>
      </div>
      <div class="screenshot-desc-col">
        <h3 style="margin-top: 0; color: #0f172a;">Layar 3 &mdash; Menu "Protocol Conversion"</h3>
        <div class="callout callout-warning" style="margin-top: 0;">
          <strong>Rekomendasi: Nonaktifkan (Set Enable: Close)</strong><br>
          USR-M100 memiliki 2 modul independen:
          <ul style="margin: 4px 0 0 0; padding-left: 18px;">
            <li><strong>Data Acquisition & Report:</strong> Polling register Modbus otomatis lalu publish JSON secara periodik (Inilah modul yang <u>digunakan</u> untuk telemetri IIoT).</li>
            <li><strong>Protocol Conversion:</strong> Jembatan transparan request-reply. Karena topik yang diisi adalah <code>/SubTopGNIS</code> dan <code>/PubTopGNIS</code>, modul ini akan bentrok atau mengirim payload kosong/ilegal ke broker.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <!-- SCREEN 4 & 5 -->
  <div class="screenshot-card">
    <div class="screenshot-flex">
      <div class="screenshot-img-col">
        <img src="{img4_b64}" alt="MQTTX Connection">
        <div style="height: 6px;"></div>
        <img src="{img5_b64}" alt="MQTTX Subscription">
        <p style="font-size: 7.5pt; color: #64748b; margin: 4px 0 0 0;">Screenshot 4 & 5: Software MQTT Client di PC (MQTTX)</p>
      </div>
      <div class="screenshot-desc-col">
        <h3 style="margin-top: 0; color: #0f172a;">Layar 4 & 5 &mdash; MQTT Client (Software Pengujian PC)</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 30%;">Parameter</th>
              <th style="width: 32%;">Status Saat Ini</th>
              <th>Perbaikan Yang Benar</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Validate Certificate</strong></td>
              <td><span class="tag-wrong">Aktif / ON (Biru)</span></td>
              <td><span class="tag-ok">OFF (Abu-abu)</span><br><small>Port 1883 adalah plain TCP non-TLS</small></td>
            </tr>
            <tr>
              <td><strong>Client ID (Advanced)</strong></td>
              <td><span class="tag-wrong">solar-jkt-GNIS_MockupUSR</span></td>
              <td><span class="tag-ok">solar-jkt-GNIS_MockupUSR-debug</span><br><small>Wajib dibedakan agar tidak menendang gateway fisik!</small></td>
            </tr>
            <tr>
              <td><strong>Topic Subscription</strong></td>
              <td><span class="tag-wrong">data//PubTopGNIS/+</span></td>
              <td><span class="tag-ok">t/solar/s/jkt/d/GNIS_MockupUSR/#</span><br><small>Wildcard # akan menangkap telemetri & LWT status</small></td>
            </tr>
          </tbody>
        </table>
        <div class="callout callout-danger" style="margin-bottom: 0;">
          <strong>Peringatan Client ID Collision:</strong><br>
          Jika Client ID di PC sama persis dengan Client ID gateway fisik (<code>solar-jkt-GNIS_MockupUSR</code>), broker EMQX akan memutuskan salah satunya (<em>"Connection closed by server"</em>) setiap kali ada yang mengirim paket.
        </div>
      </div>
    </div>
  </div>

  <h2>2. Spesifikasi Standar Template Payload JSON Telemetri</h2>
  <p>Konfigurasikan template data pada menu <strong>Data Report</strong> USR-M100 dengan format flat numeric key agar ClickHouse TSDB dan Web Dashboard dapat langsung mengekstrak metrik tanpa parsing kompleks:</p>

  <div class="summary-grid">
    <div class="summary-box">
      <strong style="color: #0f172a;">A. Template Konfigurasi USR-M100:</strong>
      <pre>{{
  "voltage": %Voltage_PLN%,
  "current": %Current_PLN%,
  "frequency": %Frequency_PLN%,
  "power": %Power_PLN%,
  "energy": %Energy_PLN%
}}</pre>
      <small style="color: #64748b;">*Gunakan token variabel Modbus yang dipetakan pada tabel Modbus USR-M100.</small>
    </div>
    <div class="summary-box">
      <strong style="color: #0f172a;">B. Hasil Payload JSON yang Diterima Broker:</strong>
      <pre>{{
  "voltage": 220.4,
  "current": 4.85,
  "frequency": 50.02,
  "power": 1068.9,
  "energy": 145.2
}}</pre>
      <small style="color: #64748b;">*Engine analitik otomatis mencatat timestamp server jika device tidak menyertakan key "ts".</small>
    </div>
  </div>

  <div class="page-break"></div>

  <h2>3. Standar Arsitektur Topik & Otorisasi ACL Platform IIoT</h2>
  
  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Tipe Pesan</th>
        <th style="width: 48%;">Format Topik Spesifik</th>
        <th style="width: 15%;">Hak Akses</th>
        <th>Fungsi</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Telemetri Sensor</strong></td>
        <td><code>t/solar/s/jkt/d/GNIS_MockupUSR/telemetry</code></td>
        <td><span class="badge badge-success">PUBLISH</span></td>
        <td>Pengiriman data analog (Tegangan, Arus, Daya, kWh)</td>
      </tr>
      <tr>
        <td><strong>Status Koneksi (LWT)</strong></td>
        <td><code>t/solar/s/jkt/d/GNIS_MockupUSR/status</code></td>
        <td><span class="badge badge-success">PUBLISH</span></td>
        <td>Pesan LWT: <code>{{"status":"offline"}}</code> saat mati mendadak</td>
      </tr>
      <tr>
        <td><strong>Command / Kendali</strong></td>
        <td><code>t/solar/s/jkt/d/GNIS_MockupUSR/cmd</code></td>
        <td><span class="badge badge-primary">SUBSCRIBE</span></td>
        <td>Penerimaan instruksi kontrol / reset dari server</td>
      </tr>
      <tr>
        <td><strong>Respons Perangkat</strong></td>
        <td><code>t/solar/s/jkt/d/GNIS_MockupUSR/resp</code></td>
        <td><span class="badge badge-success">PUBLISH</span></td>
        <td>Konfirmasi keberhasilan eksekusi command</td>
      </tr>
    </tbody>
  </table>

  <h2>4. Checklist Verifikasi Operasional Lapangan (SOP)</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 5%;">No</th>
        <th style="width: 45%;">Langkah Pengujian</th>
        <th style="width: 25%;">Target Hasil</th>
        <th style="width: 25%;">Status Verifikasi</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>Simpan & Reboot konfigurasi USR-M100 dengan Client ID <code>solar-jkt-GNIS_MockupUSR</code>.</td>
        <td>Status MQTT1 berubah menjadi <strong>Connected</strong>.</td>
        <td>[ &nbsp; ] Pass &nbsp; [ &nbsp; ] Fail</td>
      </tr>
      <tr>
        <td>2</td>
        <td>Buka MQTTX di PC dengan Client ID <code>solar-jkt-GNIS_MockupUSR-debug</code>.</td>
        <td>Koneksi berhasil tanpa memutus gateway fisik.</td>
        <td>[ &nbsp; ] Pass &nbsp; [ &nbsp; ] Fail</td>
      </tr>
      <tr>
        <td>3</td>
        <td>Subscribe ke <code>t/solar/s/jkt/d/GNIS_MockupUSR/#</code> pada MQTTX.</td>
        <td>Payload telemetri JSON muncul teratur setiap 5 detik.</td>
        <td>[ &nbsp; ] Pass &nbsp; [ &nbsp; ] Fail</td>
      </tr>
      <tr>
        <td>4</td>
        <td>Buka Web Dashboard IIoT &rarr; Device <code>GNIS_MockupUSR</code>.</td>
        <td>Indikator online menyala hijau & grafik metrik ter-update.</td>
        <td>[ &nbsp; ] Pass &nbsp; [ &nbsp; ] Fail</td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 8pt; color: #94a3b8; display: flex; justify-content: space-between;">
    <span>Platform IIoT Multisite &bull; Departemen Rekayasa IoT & Sistem Tertanam</span>
    <span>Dokumen Revisi Teknis: 07 November 2026</span>
  </div>

</body>
</html>
"""

print(f"Writing HTML to: {OUTPUT_HTML}")
with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"Executing Chrome headless to produce: {OUTPUT_PDF}")
args = [
    CHROME_PATH,
    "--headless=new",
    "--disable-gpu",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=6000",
    "--no-pdf-header-footer",
    f"--print-to-pdf={OUTPUT_PDF}",
    OUTPUT_HTML
]
subprocess.run(args, check=True)

if os.path.exists(OUTPUT_PDF):
    size = os.path.getsize(OUTPUT_PDF)
    print(f"SUCCESS: Generated PDF at {OUTPUT_PDF} ({size:,} bytes)")
else:
    print("FAILED: Output PDF not found.")

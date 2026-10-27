import os
import re
import subprocess
import markdown

SOURCE_MD = r"e:\Project\iiot_multisite\docs\superpowers\plans\2026-10-24-mitratel-sps-ongrid-implementation-plan.md"
OUTPUT_HTML = r"e:\Project\iiot_multisite\docs\superpowers\plans\temp_render.html"
OUTPUT_PDF = r"e:\Project\iiot_multisite\docs\superpowers\plans\2026-10-24-mitratel-sps-ongrid-implementation-plan.pdf"

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

def preprocess_markdown(text: str) -> tuple[str, list[str]]:
    # Extract mermaid blocks to prevent markdown parser from interfering
    mermaid_blocks = []
    
    def repl_mermaid(match):
        idx = len(mermaid_blocks)
        mermaid_code = match.group(1).strip()
        mermaid_blocks.append(mermaid_code)
        return f"\n\n<!--MERMAID_PLACEHOLDER_{idx}-->\n\n"

    # Replace ```mermaid ... ```
    text = re.sub(r"```mermaid\s*\n(.*?)```", repl_mermaid, text, flags=re.DOTALL)
    
    # Replace LaTeX inline math symbols
    text = text.replace("$\\rightarrow$", "&rarr;")
    text = text.replace("$CO_2e$", "CO<sub>2</sub>e")
    text = text.replace("−48 VDC", "&minus;48 VDC")
    
    # Clean file:/// links to just file basenames with code formatting
    text = re.sub(r'\[([^\]]+)\]\(file:///[^\)]+\)', r'<code>\1</code>', text)
    
    # Format bold text inside checkboxes or throughout before checkbox replacement
    def repl_checkbox(match):
        checked = match.group(1) == 'x'
        body = match.group(2).strip()
        # Parse bold inside body
        body = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', body)
        # Parse backticks inside body
        body = re.sub(r'`([^`]+)`', r'<code>\1</code>', body)
        if checked:
            return f'<div class="task-item completed"><span class="task-badge done">SELESAI</span><span class="task-check">&#10003;</span><span class="task-desc">{body}</span></div>'
        else:
            return f'<div class="task-item pending"><span class="task-badge todo">PENDING</span><span class="task-check">&#9675;</span><span class="task-desc">{body}</span></div>'

    text = re.sub(r'^[ \t]*- \[([ x])\] (.*?)$', repl_checkbox, text, flags=re.MULTILINE)

    # Clean up Rangkuman Deliverable page break
    text = text.replace("## Rangkuman Deliverable", '<div class="page-break"></div>\n\n## Rangkuman Deliverable')

    return text, mermaid_blocks

def main():
    print(f"Reading source: {SOURCE_MD}")
    with open(SOURCE_MD, "r", encoding="utf-8") as f:
        md_text = f.read()

    processed_md, mermaid_blocks = preprocess_markdown(md_text)

    # Convert to HTML using markdown library
    html_content = markdown.markdown(
        processed_md,
        extensions=[
            'tables',
            'fenced_code',
            'codehilite',
            'sane_lists',
            'toc',
            'attr_list'
        ]
    )

    # Re-inject mermaid blocks with enhanced wrapper
    for idx, m_code in enumerate(mermaid_blocks):
        placeholder = f"<!--MERMAID_PLACEHOLDER_{idx}-->"
        mermaid_html = f'''
        <div class="mermaid-card">
            <div class="mermaid-header">
                <div class="header-left">
                    <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
                    <span class="mermaid-title">Topologi Arsitektur SPS On-Grid (GTaaS) &mdash; Mitratel Multi-Site</span>
                </div>
                <span class="badge-tech">DC-Coupled On-Grid &minus;48V</span>
            </div>
            <div class="mermaid-body">
                <div class="mermaid">
{m_code}
                </div>
            </div>
        </div>
        '''
        html_content = html_content.replace(placeholder, mermaid_html)
        html_content = html_content.replace(f"<p>{placeholder}</p>", mermaid_html)

    full_html = f'''<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mitratel SPS On-Grid (GTaaS) Implementation Plan</title>
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    
    <!-- Mermaid.js -->
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script>
        document.addEventListener("DOMContentLoaded", function() {{
            mermaid.initialize({{
                startOnLoad: true,
                theme: 'base',
                securityLevel: 'loose',
                flowchart: {{
                    useMaxWidth: false,
                    htmlLabels: true,
                    curve: 'basis',
                    nodeSpacing: 35,
                    rankSpacing: 40
                }},
                themeVariables: {{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '13px',
                    primaryColor: '#f0f9ff',
                    primaryTextColor: '#0c4a6e',
                    primaryBorderColor: '#0284c7',
                    lineColor: '#0369a1',
                    secondaryColor: '#f0fdf4',
                    secondaryTextColor: '#14532d',
                    secondaryBorderColor: '#16a34a',
                    tertiaryColor: '#f8fafc',
                    tertiaryBorderColor: '#cbd5e1',
                    clusterBkg: '#f8fafc',
                    clusterBorder: '#94a3b8',
                    titleColor: '#0f172a'
                }}
            }});
        }});
    </script>

    <style>
        @page {{
            size: A4 portrait;
            margin: 16mm 14mm 16mm 14mm;
            @bottom-left {{
                content: "PT Dayamitra Telekomunikasi Tbk (Mitratel) — SPS On-Grid Implementation Plan";
                font-family: 'Plus Jakarta Sans', sans-serif;
                font-size: 7.5pt;
                color: #94a3b8;
            }}
            @bottom-right {{
                content: "Halaman " counter(page);
                font-family: 'Plus Jakarta Sans', sans-serif;
                font-size: 7.5pt;
                font-weight: 600;
                color: #64748b;
            }}
        }}

        *, *::before, *::after {{
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 9pt;
            line-height: 1.55;
            color: #1e293b;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }}

        /* Document Header Banner */
        .doc-header {{
            background: linear-gradient(135deg, #091e3a 0%, #0f3460 50%, #164e63 100%);
            color: #ffffff;
            padding: 22px 26px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 4px 15px rgba(15, 52, 96, 0.15);
            page-break-after: avoid;
            break-after: avoid;
        }}

        .doc-header-top {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
        }}

        .doc-badge-group {{
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }}

        .doc-badge {{
            display: inline-block;
            font-size: 7.5pt;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            padding: 3px 9px;
            border-radius: 9999px;
            background: rgba(255, 255, 255, 0.15);
            color: #e0f2fe;
            border: 1px solid rgba(255, 255, 255, 0.25);
        }}

        .doc-badge.emerald {{
            background: rgba(16, 185, 129, 0.25);
            color: #a7f3d0;
            border-color: rgba(16, 185, 129, 0.5);
        }}

        .doc-badge.amber {{
            background: rgba(245, 158, 11, 0.25);
            color: #fde68a;
            border-color: rgba(245, 158, 11, 0.5);
        }}

        .doc-title {{
            font-size: 18pt;
            font-weight: 800;
            letter-spacing: -0.5px;
            line-height: 1.25;
            margin: 0 0 8px 0;
            color: #ffffff;
        }}

        .doc-subtitle {{
            font-size: 8.8pt;
            color: #cbd5e1;
            margin: 0 0 14px 0;
            line-height: 1.45;
        }}

        .doc-meta-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            padding-top: 12px;
            border-top: 1px solid rgba(255, 255, 255, 0.15);
        }}

        .doc-meta-item {{
            display: flex;
            flex-direction: column;
        }}

        .doc-meta-label {{
            font-size: 6.8pt;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #94a3b8;
            margin-bottom: 2px;
        }}

        .doc-meta-val {{
            font-size: 8.2pt;
            font-weight: 600;
            color: #f1f5f9;
        }}

        /* Headings */
        h1 {{
            display: none;
        }}

        h2 {{
            font-size: 11pt;
            font-weight: 800;
            color: #ffffff;
            background: linear-gradient(135deg, #091e3a 0%, #1e3a8a 100%);
            padding: 8px 14px;
            border-radius: 6px;
            margin: 22px 0 12px 0;
            letter-spacing: -0.2px;
            page-break-after: avoid;
            break-after: avoid;
            box-shadow: 0 2px 6px rgba(15, 30, 58, 0.1);
        }}

        h3 {{
            font-size: 9.6pt;
            font-weight: 700;
            color: #0369a1;
            background: #f0f9ff;
            padding: 6px 10px;
            border-left: 4px solid #0284c7;
            border-radius: 0 5px 5px 0;
            margin: 16px 0 8px 0;
            page-break-after: avoid;
            break-after: avoid;
        }}

        p {{
            margin: 0 0 9px 0;
            color: #334155;
            text-align: justify;
        }}

        blockquote {{
            margin: 10px 0;
            padding: 9px 13px;
            background: #f0f9ff;
            border-left: 4px solid #0284c7;
            border-radius: 0 6px 6px 0;
            color: #0369a1;
            font-size: 8.5pt;
        }}

        blockquote p {{
            margin: 0;
            color: #0369a1;
        }}

        ul {{
            margin: 6px 0 10px 0;
            padding-left: 18px;
        }}

        li {{
            margin-bottom: 4px;
            color: #334155;
        }}

        li strong {{
            color: #0f172a;
        }}

        /* Code Blocks without scrollbars in print */
        pre {{
            background: #0f172a;
            color: #e2e8f0;
            border-radius: 6px;
            padding: 11px 13px;
            font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
            font-size: 7.6pt;
            line-height: 1.45;
            overflow: visible;
            white-space: pre-wrap;
            word-break: break-all;
            border: 1px solid #1e293b;
            margin: 9px 0;
            page-break-inside: avoid;
            break-inside: avoid;
        }}

        code {{
            font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
            font-size: 7.9pt;
            background: #f1f5f9;
            color: #0f172a;
            padding: 1.5px 4px;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
        }}

        pre code {{
            background: transparent;
            color: inherit;
            padding: 0;
            border: none;
            font-size: inherit;
        }}

        /* Tables */
        table {{
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin: 12px 0;
            font-size: 8.2pt;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            overflow: hidden;
            page-break-inside: avoid;
            break-inside: avoid;
        }}

        th {{
            background: #0f2b3c;
            color: #ffffff;
            font-weight: 700;
            text-align: left;
            padding: 7px 10px;
            border-bottom: 1px solid #cbd5e1;
            letter-spacing: 0.3px;
        }}

        td {{
            padding: 6px 10px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
            vertical-align: top;
        }}

        tr:last-child td {{
            border-bottom: none;
        }}

        tr:nth-child(even) td {{
            background-color: #f8fafc;
        }}

        /* Checkbox Task Cards */
        .task-item {{
            display: flex;
            align-items: flex-start;
            margin: 6px 0;
            padding: 6px 10px;
            border-radius: 6px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            page-break-inside: avoid;
            break-inside: avoid;
        }}

        .task-item.completed {{
            background: #f0fdf4;
            border-color: #bbf7d0;
        }}

        .task-badge {{
            font-size: 6.5pt;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 4px;
            margin-right: 8px;
            letter-spacing: 0.4px;
            flex-shrink: 0;
            margin-top: 1px;
        }}

        .task-badge.done {{
            background: #16a34a;
            color: #ffffff;
        }}

        .task-badge.todo {{
            background: #64748b;
            color: #ffffff;
        }}

        .task-check {{
            font-weight: 900;
            margin-right: 8px;
            font-size: 9pt;
            line-height: 1.2;
            flex-shrink: 0;
        }}

        .task-item.completed .task-check {{
            color: #16a34a;
        }}

        .task-item.pending .task-check {{
            color: #94a3b8;
        }}

        .task-desc {{
            color: #1e293b;
            font-size: 8.5pt;
            line-height: 1.4;
        }}

        .task-desc strong {{
            color: #0f172a;
            font-weight: 700;
        }}

        /* Mermaid Card */
        .mermaid-card {{
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            overflow: hidden;
            margin: 14px 0 18px 0;
            background: #ffffff;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            page-break-inside: avoid;
            break-inside: avoid;
        }}

        .mermaid-header {{
            background: #f1f5f9;
            padding: 6px 12px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }}

        .header-left {{
            display: flex;
            align-items: center;
            gap: 6px;
        }}

        .mermaid-header .dot {{
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
        }}
        .mermaid-header .dot.red {{ background: #ef4444; }}
        .mermaid-header .dot.yellow {{ background: #f59e0b; }}
        .mermaid-header .dot.green {{ background: #10b981; }}

        .mermaid-title {{
            font-size: 7.6pt;
            font-weight: 700;
            color: #475569;
            margin-left: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}

        .badge-tech {{
            font-size: 7pt;
            font-weight: 600;
            background: #e2e8f0;
            color: #334155;
            padding: 2px 7px;
            border-radius: 4px;
        }}

        .mermaid-body {{
            padding: 16px 12px;
            background: #ffffff;
            display: flex;
            justify-content: center;
            align-items: center;
        }}

        .mermaid svg {{
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
        }}

        hr {{
            border: none;
            border-top: 1px dashed #cbd5e1;
            margin: 16px 0;
        }}

        .page-break {{
            page-break-before: always;
            break-before: always;
        }}
    </style>
</head>
<body>

    <!-- Executive Title Banner -->
    <div class="doc-header">
        <div class="doc-header-top">
            <div class="doc-badge-group">
                <span class="doc-badge emerald">MITRATEL GTaaS</span>
                <span class="doc-badge">SPS ON-GRID</span>
                <span class="doc-badge amber">ENGINEERING IMPLEMENTATION PLAN</span>
            </div>
            <span style="font-size: 7.8pt; color: #94a3b8; font-weight: 500;">DOC ID: PLN-MTR-GTAAS-2026-V1</span>
        </div>
        <div class="doc-title">Mitratel SPS On-Grid (GTaaS) Implementation Plan</div>
        <div class="doc-subtitle">
            Rencana Eksekusi Teknis Pengembangan & Integrasi Platform IIoT Multi-Site untuk Proyek Solar Panel System (SPS) On-Grid PT Dayamitra Telekomunikasi Tbk (Mitratel) skema Green Tower as a Service (GTaaS)
        </div>
        <div class="doc-meta-grid">
            <div class="doc-meta-item">
                <span class="doc-meta-label">Prinsip Rekayasa</span>
                <span class="doc-meta-val">Zero Breaking Changes (100% Kompatibel)</span>
            </div>
            <div class="doc-meta-item">
                <span class="doc-meta-label">Topologi Listrik</span>
                <span class="doc-meta-val">DC Coupling On-Grid (-48 VDC)</span>
            </div>
            <div class="doc-meta-item">
                <span class="doc-meta-label">Integrasi Oneflux</span>
                <span class="doc-meta-val">Northbound MQTT & Open REST API</span>
            </div>
            <div class="doc-meta-item">
                <span class="doc-meta-label">Retensi Audit Data</span>
                <span class="doc-meta-val">24 Bulan (ClickHouse Storage)</span>
            </div>
        </div>
    </div>

    <!-- Main Content -->
    {html_content}

</body>
</html>
'''

    print(f"Writing rendered HTML to: {OUTPUT_HTML}")
    with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
        f.write(full_html)

    print(f"Generating PDF with Chrome headless...")
    args = [
        CHROME_PATH,
        "--headless=new",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=8000",
        "--no-pdf-header-footer",
        f"--print-to-pdf={OUTPUT_PDF}",
        OUTPUT_HTML
    ]

    subprocess.run(args, check=True)

    if os.path.exists(OUTPUT_PDF):
        size = os.path.getsize(OUTPUT_PDF)
        print(f"SUCCESS: Generated PDF at {OUTPUT_PDF} ({size:,} bytes)")
    else:
        print("ERROR: PDF was not generated.")

if __name__ == "__main__":
    main()

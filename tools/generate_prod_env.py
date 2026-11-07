#!/usr/bin/env python3
"""Generator file .env produksi dengan secret acak kriptografis yang kuat.

Contoh pemakaian:
    python3 tools/generate_prod_env.py --domain iot.contoh.id --email admin@contoh.id
    python3 tools/generate_prod_env.py --dry-run
"""
import argparse
import re
import secrets
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXAMPLE_FILE = ROOT / ".env.example"
OUTPUT_FILE = ROOT / ".env.production"


def generate_env_content(template: str, domain: str, superadmin_email: str) -> str:
    lines = []
    scheme = "https" if domain and not domain.startswith(":") and domain != "localhost" else "http"
    nextauth_url = f"{scheme}://{domain}" if not domain.startswith(":") else "http://localhost"

    for line in template.splitlines():
        if line.startswith("APP_DOMAIN="):
            lines.append(f"APP_DOMAIN={domain}")
        elif line.startswith("NEXTAUTH_URL="):
            lines.append(f"NEXTAUTH_URL={nextauth_url}")
        elif line.startswith("SUPERADMIN_EMAIL="):
            lines.append(f"SUPERADMIN_EMAIL={superadmin_email}")
        elif re.match(r"^[A-Z0-9_]+=change_me_", line):
            key = line.split("=", 1)[0]
            lines.append(f"{key}={secrets.token_urlsafe(32)}")
        else:
            lines.append(line)
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate file .env produksi dengan random secrets.")
    parser.add_argument("--domain", default=":80", help="Domain aplikasi (contoh: iot.perusahaan.com atau :80)")
    parser.add_argument("--email", default="itdev@gaungnusa.com", help="Email superadmin pertama")
    parser.add_argument("--output", default=str(OUTPUT_FILE), help="Path file output (default: .env.production)")
    parser.add_argument("--dry-run", action="store_true", help="Tampilkan hasil ke stdout tanpa menulis file")
    args = parser.parse_args()

    template = EXAMPLE_FILE.read_text(encoding="utf-8")
    content = generate_env_content(template, args.domain, args.email)

    if args.dry_run:
        print(content)
        return

    out_path = Path(args.output)
    out_path.write_text(content, encoding="utf-8")
    print(f"[ok] File environment produksi berhasil dibuat di: {out_path}")
    print("     Salin ke .env di VPS Anda sebelum menjalankan `make prod-up`.")


if __name__ == "__main__":
    main()

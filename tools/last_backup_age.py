#!/usr/bin/env python3
"""Cetak umur backup terakhir (menit) dari bucket S3. Dipakai watchdog."""
import datetime as dt
import sys

import boto3

cfg = {}
for line in open("/opt/iiot_multisite/.env"):
    line = line.strip()
    if line.startswith("S3_") and "=" in line:
        k, v = line.split("=", 1)
        cfg[k] = v

s3 = boto3.client(
    "s3",
    endpoint_url=cfg.get("S3_ENDPOINT", "http://127.0.0.1:3900"),
    aws_access_key_id=cfg["S3_ACCESS_KEY"],
    aws_secret_access_key=cfg["S3_SECRET_KEY"],
    region_name=cfg.get("S3_REGION", "us-east-1"),
)
objs = s3.list_objects_v2(Bucket=cfg.get("S3_BUCKET", "iiot-backup")).get("Contents", [])
if not objs:
    print("none")
    sys.exit(0)
newest = max(o["LastModified"] for o in objs)
print(int((dt.datetime.now(dt.timezone.utc) - newest).total_seconds() // 60))

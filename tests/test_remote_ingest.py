import urllib.request
import json

data = {
    "topic": "data/SolarMonitoringMQTT/SolarMonitoringPoC/5464118608861294690",
    "payload": {"Voltage": 220.5, "Current": 10.2, "Power": 2249.1},
    "clientid": "5464118608861294690"
}

req = urllib.request.Request(
    "http://127.0.0.1:8000/ingest",
    data=json.dumps(data).encode(),
    headers={
        "Content-Type": "application/json",
        "X-Ingest-Secret": "NtEcbz-QGNcr2oYwGiom-ZfdKYbffeDOMl1tissC2PI"
    }
)

resp = urllib.request.urlopen(req)
print("Response:", resp.read().decode())

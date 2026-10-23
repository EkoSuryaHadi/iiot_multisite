.PHONY: up down restart ps logs health e2e simulate prod-up prod-down prod-ps prod-logs prod-bootstrap

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

ps:
	docker compose ps

logs:
	docker compose logs -f

health:
	docker compose ps --format '{{.Name}}: {{.Status}}'

# === Target Produksi (Single VPS - docker-compose.prod.yml) ===
prod-up:
	docker compose -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-ps:
	docker compose -f docker-compose.prod.yml ps

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

prod-bootstrap:
	docker compose -f docker-compose.prod.yml exec device-mgmt python -m app.bootstrap

# Jalankan tes integrasi E2E (Fase 7) terhadap stack yang sedang up.
# Prasyarat: `make up` dan superadmin sudah di-bootstrap (lihat services/device-mgmt/app/bootstrap.py).
e2e:
	cd tests/e2e && \
	python3 -m venv .venv >/dev/null 2>&1 || true && \
	. .venv/bin/activate && \
	pip install -q -r requirements.txt && \
	python -m pytest -v

# Jalankan simulator device manual, contoh:
#   make simulate TENANT=mitra SITE=jkt DEVICE=gw-01 CLIENT_ID=mitra-jkt-gw-01 PASSWORD=xxx INTERVAL=2 COUNT=10
INTERVAL ?= 5
COUNT ?= 0
simulate:
	docker build -t iiot-simulator ./tools/simulator && \
	docker run --rm --network $$(docker compose ps -q postgres | xargs docker inspect -f '{{range $$k,$$v := .NetworkSettings.Networks}}{{$$k}}{{end}}') iiot-simulator \
		--host haproxy --port 1883 \
		--tenant-slug $(TENANT) --site-slug $(SITE) --device-key $(DEVICE) \
		--client-id $(CLIENT_ID) --password $(PASSWORD) \
		--interval $(INTERVAL) --count $(COUNT)

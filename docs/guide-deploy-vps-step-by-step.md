# AIDR — Hướng dẫn deploy từng bước (VPS + Docker + Nginx)

**Mục tiêu:** chạy toàn bộ trên 1 VPS theo sơ đồ:

```
Internet → domain → Nginx (:80/:443) → Docker network
                      ├─ FE static (dist/)
                      ├─ .NET API :8080
                      ├─ SQL Server :1433
                      ├─ Redis
                      └─ Keycloak (+ Postgres)
```

**File liên quan:** `docker-compose.prod.yml`, `infra/nginx/nginx.prod*.conf`, `infra/env/prod.env.example`.

> Thay `aidr.example.com` và `YOUR_GITHUB_USER` bằng domain / user GitHub thật của bạn.

---

## Bước 0 — Chuẩn bị trước (máy local)

1. Có domain trỏ được DNS.
2. Repo AIDR trên GitHub.
3. Máy local có Docker (để build thử API) và Node 20 (build FE).

Checklist tài khoản (có thể làm sau, mock trước):

- [ ] payOS / GHN / Groq / FPT.AI / SMTP / Cloudinary — hoặc để `UseMock=true` lần đầu.

---

## Bước 1 — Thuê VPS

1. Thuê VPS **Ubuntu 24.04**.
   - **4 GB RAM / 2 vCPU** — OK cho MVP nếu làm đúng phần **swap + giới hạn RAM** bên dưới (chậm hơn, dễ OOM nếu build trên VPS).
   - **8 GB RAM** — thoải mái hơn khi có traffic / SQL nặng.
   - Disk khuyến nghị **≥ 40–60 GB SSD**.
2. Ghi lại **IP public**.
3. SSH vào:

```bash
ssh root@YOUR_VPS_IP
```

4. Tạo user deploy (khuyến nghị):

```bash
adduser deploy
usermod -aG sudo deploy
# Thêm SSH public key vào /home/deploy/.ssh/authorized_keys
```

Đăng nhập lại bằng `deploy`.

### Bắt buộc trên VPS 4 GB — tạo swap 4 GB

Không có swap, SQL Server + Keycloak dễ bị kill (OOM).

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # kiểm tra Swap ~4.0Gi
```

`docker-compose.prod.yml` đã giới hạn: SQL ~1.5–1.8 GB, Keycloak ~768 MB, API ~512 MB, Redis 64 MB.

**Không** build image API / `npm run build` trên VPS 4 GB — build ở máy local hoặc GitHub Actions rồi kéo artifact/image xuống.
---

## Bước 2 — Cài Docker trên VPS

```bash
sudo apt update
sudo apt install -y ca-certificates curl ufw git

# Docker Engine (theo docs.docker.com — script tóm tắt):
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

**Đăng xuất / SSH lại** rồi kiểm tra:

```bash
docker --version
docker compose version
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## Bước 3 — DNS

Tại nhà đăng ký domain (hoặc Cloudflare):

| Type | Name | Value |
|------|------|--------|
| A | `@` | `YOUR_VPS_IP` |
| A | `www` | `YOUR_VPS_IP` |

Đợi DNS propagate (`ping aidr.example.com` ra đúng IP).

---

## Bước 4 — Clone repo + thư mục deploy trên VPS

```bash
sudo mkdir -p /opt/aidr
sudo chown $USER:$USER /opt/aidr
cd /opt/aidr

git clone https://github.com/YOUR_GITHUB_USER/aidr.git .
# hoặc clone rồi copy docker-compose.prod.yml + infra/ vào /opt/aidr
```

Tạo thư mục FE + cert:

```bash
mkdir -p fe-dist certbot/www certbot/conf
echo '<h1>AIDR — FE chưa build</h1>' > fe-dist/index.html
```

---

## Bước 5 — File môi trường `.env`

```bash
cp infra/env/prod.env.example .env
nano .env
```

Sửa tối thiểu:

- `DOMAIN=aidr.example.com` (không có `https://`)
- `MSSQL_SA_PASSWORD`, `REDIS_PASSWORD`, `KC_*` — mật khẩu mạnh
- `Jwt__SigningKey` — chuỗi ngẫu nhiên dài
- `API_IMAGE=ghcr.io/YOUR_GITHUB_USER/aidr-api:latest` (sẽ build ở bước 7)

```bash
chmod 600 .env
```

---

## Bước 6 — Chạy stack lần đầu (HTTP, chưa SSL)

Tạm dùng nginx HTTP-only (chưa có cert):

Sửa `docker-compose.prod.yml` volume nginx (hoặc lệnh one-shot):

```bash
# Trong docker-compose.prod.yml, dòng volume nginx.conf đổi tạm thành:
#   ./infra/nginx/nginx.prod.http-only.conf:/etc/nginx/nginx.conf:ro
```

Hoặc chạy:

```bash
cd /opt/aidr
# Đảm bảo API_IMAGE tồn tại — nếu chưa có image trên GHCR, build local trước (bước 7a)
docker compose -f docker-compose.prod.yml --env-file .env up -d sqlserver redis kc-db
docker compose -f docker-compose.prod.yml --env-file .env ps
```

Đợi SQL healthy (~1–2 phút):

```bash
docker compose -f docker-compose.prod.yml --env-file .env logs -f sqlserver
# Ctrl+C khi thấy sẵn sàng
```

---

## Bước 7 — Build & đẩy image API

### 7a — Trên máy local (hoặc trên VPS)

```bash
cd aidr-be
docker build -f AIDR.Api/Dockerfile -t ghcr.io/YOUR_GITHUB_USER/aidr-api:latest .
```

### 7b — Đẩy GHCR (cần Personal Access Token với `write:packages`)

```bash
echo YOUR_GITHUB_PAT | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
docker push ghcr.io/YOUR_GITHUB_USER/aidr-api:latest
```

Trên VPS:

```bash
echo YOUR_GITHUB_PAT | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
cd /opt/aidr
docker compose -f docker-compose.prod.yml --env-file .env pull api
```

> Lần đầu có thể **build ngay trên VPS** thay GHCR:

```bash
cd /opt/aidr
docker build -f aidr-be/AIDR.Api/Dockerfile -t aidr-api:local ./aidr-be
# Trong .env: API_IMAGE=aidr-api:local
```

---

## Bước 8 — Schema database

Chạy schema/data vào container SQL. **Trên Linux Docker dùng `data-new.linux.sql`** (đã bỏ đường dẫn `D:\...` Windows). Không import nguyên `data-new.sql` từ SSMS.

```bash
docker cp /opt/aidr/data-new.linux.sql aidr-sqlserver:/tmp/data-new.linux.sql

docker exec -it aidr-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'YOUR_MSSQL_SA_PASSWORD' -C \
  -i /tmp/data-new.linux.sql
```
---

## Bước 9 — Keycloak + API + Nginx

```bash
cd /opt/aidr
# Dùng nginx.prod.http-only.conf trong compose trước khi có SSL
docker compose -f docker-compose.prod.yml --env-file .env up -d keycloak api nginx
docker compose -f docker-compose.prod.yml --env-file .env ps
```

Smoke (HTTP tạm):

```bash
curl -fsS http://YOUR_VPS_IP/api/health/live
curl -fsS http://YOUR_VPS_IP/api/health/ready
```

Keycloak admin (lần đầu): mở `http://YOUR_DOMAIN/auth/admin` — đổi password sau khi login.

Cập nhật client `aidr-fe` trong realm:

- Valid redirect URIs: `https://aidr.example.com/*`
- Web origins: `https://aidr.example.com`

---

## Bước 10 — SSL (Let's Encrypt)

```bash
cd /opt/aidr
docker run --rm -it \
  -v /opt/aidr/certbot/conf:/etc/letsencrypt \
  -v /opt/aidr/certbot/www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d aidr.example.com -d www.aidr.example.com \
  --email you@example.com --agree-tos --non-interactive
```

> Nếu nginx đang giữ port 80: tạm `docker compose stop nginx`, chạy certbot, rồi start lại.

Sửa `infra/nginx/nginx.prod.conf`: thay mọi `DOMAIN_PLACEHOLDER` bằng `aidr.example.com`.

Đổi compose volume nginx về `nginx.prod.conf`, rồi:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d nginx
curl -fsS https://aidr.example.com/api/health/ready
```

---

## Bước 11 — Build Frontend

Trên máy local:

```bash
cd aidr-fe
cat > .env.production << 'EOF'
VITE_API_BASE_URL=/api
VITE_SIGNALR_HUB_URL=/hubs
VITE_KEYCLOAK_URL=https://aidr.example.com/auth
VITE_KEYCLOAK_REALM=aidr
VITE_KEYCLOAK_CLIENT_ID=aidr-fe
VITE_AUTH_GOOGLE_REDIRECT_URI=https://aidr.example.com/auth/callback
VITE_CLOUDINARY_CLOUD_NAME=your_cloud
VITE_CLOUDINARY_UPLOAD_PRESET=your_preset
EOF

npm ci
npm run build
```

Đẩy `dist` lên VPS:

```bash
rsync -az --delete dist/ deploy@YOUR_VPS_IP:/opt/aidr/fe-dist/
```

Trên VPS không cần reload nếu chỉ đổi file static; nếu muốn chắc chắn:

```bash
docker exec aidr-nginx nginx -s reload
```

Mở `https://aidr.example.com` trên trình duyệt.

---

## Bước 12 — Kiểm tra sau deploy

| Kiểm tra | Lệnh / hành động |
|----------|------------------|
| API live | `curl https://DOMAIN/api/health/live` |
| API ready | `curl https://DOMAIN/api/health/ready` |
| FE | Mở trang chủ, không lỗi JS console |
| Login | Email/password hoặc Google (nếu đã cấu hình IdP) |
| SignalR | Chat / notification (WebSocket) |
| Dev API | `POST /api/dev/*` phải **404/blocked** |

---

## Bước 13 — CI/CD (GitHub Actions)

Xem hướng dẫn đầy đủ: [`docs/guide-github-actions-deploy.md`](guide-github-actions-deploy.md).

Workflow: `.github/workflows/deploy-production.yml` — push `main` → build API/FE → deploy VPS.

---

## Lệnh vận hành thường dùng

```bash
cd /opt/aidr

# Xem log
docker compose -f docker-compose.prod.yml --env-file .env logs -f api

# Restart API sau đổi .env
docker compose -f docker-compose.prod.yml --env-file .env up -d api

# Backup volume SQL (đơn giản)
docker run --rm -v aidr_aidr_mssql_data:/data -v /opt/aidr/backups:/backup alpine \
  tar czf /backup/mssql-$(date +%F).tgz /data
```

---

## Xử lý lỗi thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|-------------|---------------------------|
| SQL không healthy | Password không đủ mạnh; xem `logs sqlserver` |
| `/api/health/ready` fail | Schema chưa chạy; Redis password sai |
| Keycloak 404 | Sai `KC_HTTP_RELATIVE_PATH` / nginx `/auth/` |
| FE trắng trang | Chưa rsync `dist`; sai `VITE_*` (cần build lại) |
| CORS error | `Cors__Origins` phải khớp `https://DOMAIN` |
| Port 80 busy khi certbot | `docker compose stop nginx` rồi chạy certbot |

---

## Thứ tự tóm tắt (checklist)

- [ ] 1. Thuê VPS Ubuntu (**4 GB OK** nếu có swap 4 GB; 8 GB thoải hơn)
- [ ] 1b. Tạo swap 4 GB (bắt buộc nếu RAM 4 GB)
- [ ] 2. Cài Docker + UFW
- [ ] 3. DNS A → IP
- [ ] 4. Clone repo vào `/opt/aidr`
- [ ] 5. Điền `.env` (kèm `MSSQL_MEMORY_LIMIT_MB=1536`)
- [ ] 6. Up SQL + Redis + Postgres KC
- [ ] 7. Build/push image API (**trên máy local / CI**, không trên VPS 4 GB)
- [ ] 8. Chạy `database.sql`
- [ ] 9. Up Keycloak + API + Nginx (HTTP)
- [ ] 10. Certbot SSL → nginx HTTPS
- [ ] 11. Build FE (**local**) + rsync `fe-dist`
- [ ] 12. Smoke test
- [ ] 13. (Sau) bật CI/CD

Khi xong bước 1–2 trên VPS, báo lại IP/domain (có thể che một phần) để đi tiếp bước DNS/compose cụ thể.

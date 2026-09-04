# Setup AIDR trên macOS

Hướng dẫn chạy **Backend + Frontend** trên Mac khi **không cài SQL Server native**. Dùng **Docker** cho SQL Server và import file **`data-aidr.sql`** ở thư mục gốc repo (schema + dữ liệu demo đầy đủ).

> Tham chiếu chung: [`handover-run-src.md`](./handover-run-src.md) · Infra Docker: [`README.md`](./README.md)

---

## Yêu cầu

| Tool | Phiên bản | Ghi chú |
|------|-----------|---------|
| macOS | 12+ | Intel hoặc Apple Silicon (M1/M2/M3…) |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Mới nhất | Bật **≥ 4 GB RAM** cho container SQL |
| [.NET SDK](https://dotnet.microsoft.com/download) | **9** | Backend |
| [Node.js](https://nodejs.org/) | **18+** | Frontend |
| Git | — | Clone repo |

Tuỳ chọn:

| Tool | Khi nào cần |
|------|-------------|
| [Azure Data Studio](https://azure.microsoft.com/products/data-studio/) | Xem/sửa DB bằng GUI thay vì `sqlcmd` |
| Redis / Keycloak (Docker) | OAuth Google, cache Redis thật |

---

## 1. Clone repo

```bash
git clone <repo-url> aidr
cd aidr
```

Đảm bảo có file `data-aidr.sql` ở thư mục gốc (cùng cấp `docker-compose.yml`).

---

## 2. SQL Server qua Docker

### 2.1 Khởi động container

Từ thư mục gốc repo:

```bash
docker compose up -d sqlserver
```

Kiểm tra container healthy (lần đầu có thể mất 30–60 giây):

```bash
docker compose ps sqlserver
# hoặc
docker logs aidr-sqlserver --tail 20
```

Thông tin đăng nhập mặc định (khớp `docker-compose.yml`):

| | |
|---|---|
| Host | `localhost,1433` |
| User | `sa` |
| Password | `Your_strong_Password123` |
| Database | `AIDR` |

### 2.2 Tạo database trống

File `data-aidr.sql` được export từ SSMS trên Windows — phần đầu có `CREATE DATABASE` với đường dẫn ổ `D:\...` **không chạy được trên Docker/Mac**. Tạo DB thủ công trước:

```bash
docker exec aidr-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "Your_strong_Password123" -C \
  -Q "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'AIDR') CREATE DATABASE AIDR;"
```

---

## 3. Import `data-aidr.sql` (schema + seed data)

`data-aidr.sql` gồm:

- Toàn bộ **schema** (bảng, FK, constraint, index…)
- Toàn bộ **dữ liệu demo** (users, catalog, orders, inventory lots, AI conversations…)

Sau khi import **không cần** gọi `POST /api/dev/seed-all` trừ khi muốn reset/bổ sung qua API.

### 3.1 Import bằng terminal (khuyến nghị)

Bỏ qua **82 dòng đầu** (block `CREATE DATABASE` Windows), import từ `USE [AIDR]` trở đi:

```bash
# Từ thư mục gốc repo
tail -n +83 data-aidr.sql | docker exec -i aidr-sqlserver \
  /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "Your_strong_Password123" -C -d AIDR -b
```

- `-b` — dừng ngay khi gặp lỗi SQL.
- Import mất vài phút tùy máy.

### 3.2 Import bằng Azure Data Studio

1. Cài Azure Data Studio (bản macOS).
2. **New Connection** → `localhost,1433` · `sa` · `Your_strong_Password123`.
3. Tạo database `AIDR` nếu chưa có.
4. Mở file `data-aidr.sql` → **bỏ chọn/xóa dòng 1–82** (từ `USE [master]` đến trước `USE [AIDR]`).
5. Chạy script trên database **AIDR**.

### 3.3 Import lại từ đầu (reset DB)

```bash
docker exec aidr-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "Your_strong_Password123" -C \
  -Q "ALTER DATABASE AIDR SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE AIDR; CREATE DATABASE AIDR;"

tail -n +83 data-aidr.sql | docker exec -i aidr-sqlserver \
  /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "Your_strong_Password123" -C -d AIDR -b
```

### 3.4 Kiểm tra nhanh sau import

```bash
docker exec aidr-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "Your_strong_Password123" -C -d AIDR \
  -Q "SELECT COUNT(*) AS UserCount FROM Users; SELECT COUNT(*) AS ProductCount FROM Products;"
```

Kỳ vọng: có users và products (số dòng > 0).

---

## 4. Cấu hình Backend

Sửa connection string trong `aidr-be/AIDR.Api/appsettings.Development.json`:

**Trước (Windows / SQLEXPRESS):**

```json
"AidrDb": "Server=.\\SQLEXPRESS;Database=AIDR;Trusted_Connection=True;TrustServerCertificate=True;"
```

**Sau (Mac + Docker):**

```json
"AidrDb": "Server=localhost,1433;Database=AIDR;User Id=sa;Password=Your_strong_Password123;TrustServerCertificate=True;"
```

Giữ nguyên (khuyến nghị cho dev local không cần Redis):

```json
"Caching": {
  "UseInMemory": true
}
```

---

## 5. Chạy Backend

```bash
cd aidr-be
dotnet run --project AIDR.Api
```

| Endpoint | URL |
|----------|-----|
| API | http://localhost:5080 |
| Health (live) | http://localhost:5080/api/health/live |
| Health (ready) | http://localhost:5080/api/health/ready |

Health **ready** kiểm tra SQL — nếu fail, xem lại bước import và connection string.

---

## 6. Chạy Frontend

Terminal mới:

```bash
cd aidr-fe
cp .env.example .env
npm install
npm run dev
```

| | |
|---|---|
| UI | http://localhost:5173 |
| Proxy API | Vite proxy `/api` → `http://localhost:5080` |

**Backend phải chạy trước** khi mở UI.

---

## 7. Đăng nhập demo

Dữ liệu trong `data-aidr.sql` đã có sẵn các tài khoản:

| Email | Password | Vai trò |
|-------|----------|---------|
| `buyer@aidr.local` | `Aidr@123` | Buyer |
| `seller@aidr.local` | `Aidr@123` | Seller |
| `admin@aidr.local` | `Aidr@123` | Admin |

---

## 8. Checklist nhanh

1. Docker Desktop đang chạy  
2. `docker compose up -d sqlserver` → healthy  
3. Tạo DB `AIDR`  
4. Import `tail -n +83 data-aidr.sql | …` thành công  
5. Sửa `appsettings.Development.json` → `localhost,1433`  
6. `dotnet run` → `/api/health/ready` OK  
7. `npm run dev` → mở http://localhost:5173  
8. Login `buyer@aidr.local` / `Aidr@123`  

---

## 9. Tuỳ chọn

### Redis + Keycloak (Google OAuth)

```bash
docker compose up -d redis keycloak
```

Đổi `Caching:UseInMemory` → `false` nếu muốn dùng Redis. Keycloak: http://localhost:8080 (admin / admin).

### Seed thêm qua API (không bắt buộc)

Nếu đã import `data-aidr.sql`, thường **không cần**. Chỉ dùng khi muốn chạy lại seeder dev:

```bash
curl -X POST http://localhost:5080/api/dev/seed-all
```

> Cảnh báo: có thể trùng/lệch dữ liệu nếu DB đã có data từ `data-aidr.sql`.

### PayOS / GHN / Groq / SMTP / Cloudinary

Cấu hình trong `appsettings.Development.json` hoặc `dotnet user-secrets` — **không bắt buộc** để xem UI và duyệt catalog cơ bản.

---

## 10. Xử lý sự cố

| Triệu chứng | Cách xử lý |
|-------------|------------|
| `CREATE DATABASE` fail với path `D:\...` | Bỏ 82 dòng đầu; tạo DB `AIDR` riêng (mục 2.2 + 3.1) |
| `Login failed for user 'sa'` | Kiểm tra password khớp `docker-compose.yml` |
| Port `1433` đã dùng | Tắt SQL local khác hoặc đổi port mapping trong `docker-compose.yml` |
| SQL container restart liên tục | Tăng RAM Docker Desktop (Settings → Resources → ≥ 4 GB) |
| Apple Silicon chậm lần đầu | Bình thường — image SQL Server chạy qua emulation |
| BE `/api/health/ready` fail | Connection string sai; DB chưa import; container SQL chưa healthy |
| Checkout báo thiếu stock | `data-aidr.sql` đã có `InventoryLots` — nếu import lỗi giữa chừng, reset DB (mục 3.3) và import lại |
| `tail: command not found` | Dùng Azure Data Studio (mục 3.2) hoặc `sed -n '83,$p' data-aidr.sql \| …` |

---

## Phân biệt `data-aidr.sql` vs `database.sql`

| File | Nội dung | Khi nào dùng |
|------|----------|--------------|
| `database.sql` | Chỉ schema (không data) | Setup trống + seed qua API `/api/dev/seed-*` |
| `data-aidr.sql` | Schema + **toàn bộ data demo** | Setup nhanh trên Mac (doc này) |

---

## Liên quan

- Chạy src chung (Windows/Linux): [`handover-run-src.md`](./handover-run-src.md)
- Docker full stack (API + NGINX trong container): [`README.md`](./README.md)
- Deploy production: [`solution-production-deployment.md`](./solution-production-deployment.md)

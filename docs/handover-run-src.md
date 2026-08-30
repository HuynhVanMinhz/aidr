# Handover — Chạy src local

## Yêu cầu

| Tool | Ghi chú |
|------|---------|
| .NET 9 SDK | BE |
| Node 18+ | FE |
| SQL Server | Local `SQLEXPRESS` hoặc Docker `:1433` |
| Docker (tuỳ chọn) | Redis + Keycloak nếu cần OAuth/Google |

## 1. Database (lần đầu)

```bash
# Chỉ infra (nếu chưa có SQL local)
docker compose up -d sqlserver redis keycloak
```

Chạy `database.sql` vào DB **AIDR** (SSMS / Azure Data Studio).

Connection mặc định dev: `Server=.\SQLEXPRESS;Database=AIDR;Trusted_Connection=True;TrustServerCertificate=True;`  
→ sửa `ConnectionStrings:AidrDb` trong `aidr-be/AIDR.Api/appsettings.Development.json` nếu khác.

## 2. Backend

```bash
cd aidr-be
dotnet run --project AIDR.Api
```

- API: http://localhost:5080  
- Health: http://localhost:5080/api/health/live  

Dev dùng JWT nội bộ (`Jwt:SigningKey` trong appsettings). Redis có thể bỏ qua (`Caching:UseInMemory: true`).

## 3. Frontend

```bash
cd aidr-fe
cp .env.example .env
npm install
npm run dev
```

- UI: http://localhost:5173  
- Vite proxy `/api` → `http://localhost:5080` (BE phải chạy trước).

## 4. Seed tối thiểu (dev)

Gọi khi `ASPNETCORE_ENVIRONMENT=Development`:

```http
POST http://localhost:5080/api/dev/seed-all
```

Endpoint trên chạy toàn bộ seed demo theo thứ tự nghiệp vụ (accounts → catalog → … → table-coverage) rồi **reconcile + validate** dữ liệu.

Bước `table-coverage` seed các bảng còn trống: ProductVariants, ProductPriceHistories, SellerRatings, ShopBankAccounts, PayoutBatches, PasswordResetTokens, Addresses bổ sung, SellerFollows.

Hoặc seed từng phần:

```http
POST http://localhost:5080/api/dev/seed-demo-accounts
POST http://localhost:5080/api/dev/seed-catalog
POST http://localhost:5080/api/dev/seed-inventory-lots
POST http://localhost:5080/api/dev/seed-reconcile-data
GET  http://localhost:5080/api/dev/validate-data
```

`validate-data` kiểm tra **48 bảng** (row count) + **74 rule** (orphan FK, counter drift, business rule). Response gồm `tableCounts`, `issuesByType`, `issues`.

> **Bắt buộc** `seed-inventory-lots` (hoặc `seed-all`) — thiếu lô tồn kho thì checkout fail dù `StockQuantity` > 0.

## 5. Đăng nhập demo

| Email | Password |
|-------|----------|
| `buyer@aidr.local` | `Aidr@123` |
| `seller@aidr.local` | `Aidr@123` |
| `admin@aidr.local` | `Aidr@123` |

## Checklist nhanh

1. SQL có DB `AIDR` + schema  
2. `dotnet run` → health OK  
3. `npm run dev` → mở http://localhost:5173  
4. Seed 3 endpoint trên  
5. Login buyer → duyệt catalog / account  

## Ghi chú

- PayOS / GHN / Groq / SMTP: cấu hình trong `appsettings.Development.json` hoặc `dotnet user-secrets` — không bắt buộc để xem UI cơ bản.
- Chi tiết infra Docker full stack: `docs/README.md`.

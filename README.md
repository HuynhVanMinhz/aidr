# AIDR Foundation / Infrastructure

Scaffold theo `architecture-aidr-be.md` + `architecture-aidr-fe.md` + module **01** trong `plan-implement-module.md`.

## Cấu trúc

```
aidr-be/          .NET 9 modular monolith (Api, Modules, Infrastructure, Shared)
aidr-fe/          React + Vite + Redux + Router + Axios + SignalR client
infra/nginx/      Reverse proxy config
infra/keycloak/   Realm import (aidr)
database.sql      Schema SQL Server (chạy thủ công lần đầu)
docker-compose.yml
```

## Chạy local (dev)

### 1. Infra (SQL + Redis + Keycloak + API + NGINX)

```bash
docker compose up -d sqlserver redis keycloak
# Sau khi SQL healthy: chạy database.sql vào DB AIDR
docker compose up -d --build api nginx
```

Hoặc full stack:

```bash
docker compose up -d --build
```

### 2. Apply schema

Chạy `database.sql` trên SQL Server (`localhost,1433`, sa / `Your_strong_Password123`).

### 3. Backend (không Docker)

```bash
cd aidr-be
dotnet run --project AIDR.Api
# http://localhost:5080/api/health/live
```

### 4. Frontend

```bash
cd aidr-fe
cp .env.example .env
npm install
npm run dev
# http://localhost:5173
```

## Health endpoints

| URL | Ý nghĩa |
|-----|---------|
| `GET /api/health/live` | Process sống |
| `GET /api/health/ready` | SQL Server + Redis |

## Ghi chú Foundation

- Chưa có UI nghiệp vụ (Auth/Catalog…) — chỉ shell FE + health page.
- JWT Keycloak đã wire; Auth module (UC-01..) làm ở plan item 02.
- EF Core map subset entity cốt lõi; entity còn lại bổ sung theo module.
- UI màn hình sau này: convert từ `theme-for-aidr-fe` (xem rule `aidr-ui-theme`).

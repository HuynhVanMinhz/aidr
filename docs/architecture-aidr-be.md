# AIDR Backend Architecture (`aidr-be`)

**Project:** AIDR — AI-Integrated Digital Retail  
**Runtime:** .NET (ASP.NET Core) · **DB:** SQL Server (Aiven) · **Realtime:** SignalR · **Cache:** Redis

---

## 1. Mục tiêu kiến trúc

Backend là **hub xử lý nghiệp vụ** của AIDR: nhận request từ FE qua NGINX, xác thực/ủy quyền với Keycloak, thực thi domain logic, ghi SQL Server, cache Redis, phát event realtime qua SignalR, và gọi các dịch vụ ngoài (payOS, Google, Ollama, SMTP, Cloudinary metadata).

---

## 2. Kiến trúc tổng thể (theo System Architecture Diagram)

```
React (aidr-fe) ──HTTPS──► NGINX ──Authen/Author──► Keycloak
                              │
                              ▼
                         .NET API  ◄──► Redis (Caching)
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
               SignalR    SQL Server   External
               (Pub/Sub)   (Aiven)     payOS / Google / Ollama
                              │
                         Docker + Grafana
```

| Layer | Thành phần | Vai trò |
|-------|-------------|---------|
| Gateway | **NGINX** | Reverse proxy, TLS termination, route `/api`, `/hubs` |
| IAM | **Keycloak** | OAuth2 / OIDC; Login email + Google IdP |
| API | **.NET** | Business logic, REST + SignalR hubs |
| Cache | **Redis** | Cache catalog, session phụ trợ, rate-limit phụ |
| Realtime | **SignalR** | Chat, notifications, order status push |
| Data | **SQL Server @ Aiven** | Source of truth (xem `database.sql`) |
| Ops | **Docker**, **Grafana** | Deploy nhất quán + giám sát |
| External | **payOS**, **Google**, **Ollama** | Payment, social login, AI |

---

## 3. Package / Solution structure

Theo SDD (Table 21) — modular monolith:

```
aidr-be/
├── AIDR.Api                 # Controllers, Middleware, SignalR Hubs, DI composition
├── AIDR.Modules             # Domain application services (use-case oriented)
│   ├── Auth
│   ├── Profile
│   ├── Discovery            # search, filter, category, product public read
│   ├── SellerCenter         # products, inventory, shop orders, vouchers, wallet, dashboard
│   ├── Order                # cart, checkout, buyer orders, returns (buyer side)
│   ├── Payment              # payOS integration
│   ├── Engagement           # reviews, wishlist, follow, ratings, chat, notifications
│   ├── AI                   # chatbot, compare, NL→filter, recommendations
│   └── Admin                # moderation, categories, users, seller requests, system vouchers, insights
├── AIDR.Infrastructure      # EF Core, Redis, Keycloak, payOS, Ollama, SMTP, Cloudinary clients
└── AIDR.Shared              # DTOs, Result types, constants, exceptions
```

**Nguyên tắc:** Controllers mỏng → Module service → Repository / external client. Không đặt business rule trong Controller.

---

## 4. Request flow chuẩn

1. Client gọi `https://api.../api/...` hoặc kết nối SignalR hub.
2. **NGINX** terminate HTTPS, forward tới container .NET; có thể validate JWT với Keycloak (auth_request) hoặc để .NET validate JWT.
3. **AIDR.Api** middleware: correlation-id, exception handler, auth (`[Authorize]` + role policies).
4. Module thực thi use case → đọc/ghi **SQL Server**; invalidate / set **Redis** khi cần.
5. Side-effects: publish SignalR group, gọi payOS/Ollama/SMTP.

---

## 5. AuthN / AuthZ

| Concern | Thiết kế |
|---------|----------|
| Identity provider | Keycloak (realm AIDR); Google làm federated IdP (UC-03) |
| Token | Access JWT (short) + Refresh; claim `sub`, `email`, `realm_roles` |
| App user sync | Lần đầu login: upsert `Users.KeycloakSub` + gán role mặc định `BUYER` |
| Role policies | `Buyer`, `Seller`, `Admin` map từ Keycloak roles ↔ `UserRoles` |
| Local endpoints | Register / Forgot password có thể proxy qua Keycloak Admin API hoặc app flow + sync |

**UC mapping:** UC-01..UC-08 → module `Auth` + `Profile`.

---

## 6. Module ↔ Use Case mapping

### 6.1 Auth & Profile
| UC | Endpoint (gợi ý) | Module |
|----|------------------|--------|
| UC-01 Register | `POST /api/auth/register` | Auth |
| UC-02 Login email | `POST /api/auth/login` (hoặc Keycloak token endpoint) | Auth |
| UC-03 Google | OIDC redirect / code exchange | Auth |
| UC-04 Logout | `POST /api/auth/logout` | Auth |
| UC-05 Forget password | `POST /api/auth/forgot-password` | Auth |
| UC-06 Change password | `POST /api/auth/change-password` | Auth |
| UC-07/08 Profile | `GET/PUT /api/profile` | Profile |

### 6.2 Discovery (public)
| UC | Endpoint | Module |
|----|----------|--------|
| UC-09/10/11 | `GET /api/products`, `GET /api/products/{id}`, `GET /api/categories` | Discovery |
| UC-26/27 | `GET /api/products/search?q=&filters=&sort=` | Discovery |
| UC-53/54 | `GET /api/recommendations`, `GET /api/products/{id}/similar` | AI + Discovery |

### 6.3 Seller Center
| UC | Endpoint | Module |
|----|----------|--------|
| UC-12 | `POST /api/seller/products` — create (status `Pending`) | SellerCenter |
| UC-13 | `POST /api/seller/products/{id}/images` — lưu Cloudinary URL/publicId | SellerCenter |
| UC-14 | `PUT /api/seller/products/{id}` — update → reset `Pending` | SellerCenter |
| UC-15 | `DELETE /api/seller/products/{id}` — soft-delete (`Deleted`) | SellerCenter |
| UC-16 | `GET /api/seller/products`, `GET /api/seller/products/{id}` | SellerCenter |
| UC-17 | inventory adjust (module Inventory & Pricing) | SellerCenter |
| UC-91 | `POST /api/seller/products/{id}/lots` — nhập lô + UnitCost | SellerCenter |
| UC-92 | `PATCH /api/seller/products/{id}/price` — đổi giá bán + ghi history | SellerCenter |
| UC-46/47 | `GET/PATCH /api/seller/orders` | SellerCenter |
| UC-69/70 | `GET /api/seller/dashboard`, `/reports` | SellerCenter |
| UC-85 | `GET /api/seller/wallet` | SellerCenter |
| UC-87..89 | Shop vouchers CRUD | SellerCenter |

### 6.4 Order & Payment
| UC | Endpoint | Module |
|----|----------|--------|
| UC-29..31 | Cart APIs | Order |
| UC-32/33 | Voucher list / apply preview | Order |
| UC-34 | `POST /api/orders` | Order |
| UC-35 | `POST /api/payments/payos/create` + webhook | Payment |
| UC-39..43 | Buyer order + return request | Order |

### 6.5 Admin
| UC | Endpoint | Module |
|----|----------|--------|
| UC-18..21 | Product moderation + history | Admin |
| UC-22..25 | Categories | Admin |
| UC-48..52 | Return requests | Admin |
| UC-71..74 | Insights, accounts lock/unlock | Admin |
| UC-75 | `GET /api/admin/seller-registrations` (default `status=Pending`; `status=all` for every status); `GET /api/admin/seller-registrations/{id}` | Admin |
| UC-76 | `POST /api/admin/seller-registrations/{id}/approve` → role Seller + Shop + Wallet; `POST .../reject` + `adminNote` | Admin |
| UC-78..81 | System vouchers | Admin |

### 6.6 Engagement
| UC | Endpoint / Hub | Module |
|----|----------------|--------|
| UC-36..38 | Wishlist | Engagement |
| UC-44/45 | Notifications REST (+ SignalR push) | Engagement |
| UC-57/58 | Chat REST + `ChatHub` | Engagement |
| UC-59..64 | Reviews & seller ratings | Engagement |
| UC-65..67 | Follows | Engagement |

### 6.7 AI
| UC | Endpoint | Module |
|----|----------|--------|
| UC-28 | `POST /api/ai/compare` | AI |
| UC-56 | `POST /api/ai/chat` hoặc stream hub | AI |
| UC-90 | `POST /api/ai/nl-filter` → JSON filter DSL | AI |

---

## 7. Tích hợp kỹ thuật chi tiết

### 7.1 SQL Server (Aiven)
- EF Core `AIDRDbContext` map schema trong `database.sql`.
- Transaction cho checkout: tạo Order + OrderItems + reserve stock + Payment pending.
- Index search: Category+Status, Name; recommendation tables cập nhật job nền.

### 7.2 Redis
| Key pattern | TTL | Dùng cho |
|-------------|-----|----------|
| `catalog:products:{page}:{hash}` | ngắn (1–5 phút) | UC-09 list |
| `product:{id}` | ngắn | UC-10 |
| `categories:tree` | dài hơn | UC-11 |
| `user:{id}:cart` | optional | tăng tốc UC-29 |

Invalidate khi Seller/Admin mutate product/category.

### 7.3 SignalR (Pub/Sub)
Hubs đề xuất:
- `NotificationHub` — group `user:{userId}` (UC-44)
- `ChatHub` — group `thread:{threadId}` (UC-57/58)
- `OrderHub` (optional) — buyer/seller nhận status change (UC-47)

### 7.4 payOS
1. `CreateOrder` → `CreatePaymentLink` → trả `CheckoutUrl`.
2. Webhook `POST /api/payments/payos/webhook` verify signature → `Payments.Status=Succeeded`, `Orders.Status=Paid`.
3. Idempotent theo `ProviderPaymentId`.

### 7.5 Ollama
- HTTP client tới Ollama host trong Docker network.
- Prompt templates: compare products (UC-28), shopping assistant (UC-56), NL→filter JSON schema (UC-90).
- Không tin LLM output mù quáng: validate filter schema trước khi query SQL.

### 7.6 Cloudinary
- FE upload trực tiếp; BE nhận URL/publicId khi Create/Update Product (UC-13).
- BE có thể verify signature / xóa ảnh khi soft-delete product (optional).

### 7.7 Google
- Qua Keycloak Identity Provider (khuyến nghị) — BE không tự xử lý OAuth password.

---

## 8. Cross-cutting concerns

| Concern | Cách làm |
|---------|----------|
| Validation | FluentValidation / DataAnnotations trên command DTOs |
| Errors | ProblemDetails (`RFC7807`); business exceptions typed |
| Logging | Serilog → structured logs; Grafana dashboards |
| Metrics | ASP.NET metrics + Grafana (latency, 5xx, hub connections) |
| Config | `appsettings` + env vars trong Docker |
| Secrets | không commit; inject qua env / secret store |
| CORS | chỉ origin FE production / staging |
| Rate limit | login & AI endpoints |

---

## 9. Deployment (Docker)

Services gợi ý trong compose:
- `aidr-api` (.NET)
- `nginx`
- `keycloak`
- `redis`
- `ollama` (+ model volume)
- SQL Server trên **Aiven** (managed, ngoài compose) hoặc container local cho dev
- `grafana` (+ prometheus nếu có)

Pipeline: build image → push registry → deploy staging → smoke test `/health`.

---

## 10. Health & Observability

| Endpoint | Mục đích |
|----------|----------|
| `GET /health` | liveness |
| `GET /health/ready` | DB + Redis readiness |
| Grafana | CPU/RAM container, request RPS, error rate, SignalR connections |

---

## 11. Mapping thực thể DB quan trọng (BE)

| Module | Tables chính |
|--------|----------------|
| Auth/Profile | Users, Roles, UserRoles, Addresses, PasswordResetTokens |
| Discovery/Seller products | Categories, Products, ProductImages, ProductVariants, InventoryLots, ProductPriceHistories, InventoryTransactions, ProductModerationHistory |
| Order | Carts, CartItems, Orders, OrderItems, OrderStatusHistories, Vouchers, VoucherRedemptions |
| Payment | Payments |
| Return | ReturnRequests, ReturnRequestItems, ReturnStatusHistories |
| Engagement | WishlistItems, ProductReviews, SellerRatings, SellerFollows, Notifications, ChatThreads, ChatMessages |
| Seller finance | Shops, Wallets, WalletTransactions |
| Admin seller onboarding | SellerRegistrationRequests |
| AI | ViewedProductHistories, ProductRecommendations, AiConversations, AiMessages |

---

## 12. Non-goals (MVP)

- Không tích hợp GHN/GHTK tracking API (seller nhập tracking thủ công).
- Không AI auto-resolve tranh chấp return phức tạp.
- Không tách microservices giai đoạn MVP (giữ modular monolith).

---

## 13. Tài liệu liên quan

- `bussiness-system.md` — nghiệp vụ & UC
- `database.sql` — schema SQL Server
- `architecture-aidr-fe.md` — frontend
- Report7 — System Design §1.1 / Table 21

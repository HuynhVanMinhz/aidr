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
│   ├── Discovery            # search, filter, category, product/shop public read
│   ├── SellerCenter         # products, inventory, shop orders, vouchers, wallet, dashboard
│   ├── Order                # cart, checkout, vouchers (buyer), buyer orders, returns (buyer side)
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
| UC-62b | `GET /api/shops/{shopKey}` — shop profile, policies, rating, approved products (paged; `shopKey` = ShopId hoặc Slug) | Discovery |
| UC-64 | `GET /api/shops/{shopKey}/rating` — AvgRating + RatingCount | Discovery |
| UC-53/54 | `GET /api/recommendations`, `GET /api/products/{id}/similar` | AI + Discovery |

### 6.3 Seller Center
| UC | Endpoint | Module |
|----|----------|--------|
| UC-12 | `POST /api/seller/products` — create (status `Pending`) | SellerCenter |
| UC-13 | `POST /api/seller/products/{id}/images` — lưu Cloudinary URL/publicId | SellerCenter |
| UC-14 | `PUT /api/seller/products/{id}` — update → reset `Pending` | SellerCenter |
| UC-15 | `DELETE /api/seller/products/{id}` — soft-delete (`Deleted`) | SellerCenter |
| UC-16 | `GET /api/seller/products`, `GET /api/seller/products/{id}` | SellerCenter |
| UC-17 | `GET /api/seller/inventory`; `GET/PATCH /api/seller/products/{id}/inventory`; `POST .../inventory/adjust` | SellerCenter |
| UC-91 | `POST /api/seller/products/{id}/lots` — nhập lô + UnitCost | SellerCenter |
| UC-92 | `PATCH /api/seller/products/{id}/price` — đổi giá bán + ghi history | SellerCenter |
| UC-46/47 | `GET /api/seller/orders`, `GET/PATCH /api/seller/orders/{orderId}` — shop orders; status Paid→Confirmed→Shipping→Delivered + tracking | SellerCenter |
| UC-69 | `GET /api/seller/dashboard` — KPI đơn (kể cả awaiting fulfillment), doanh thu recognized (Completed), tồn thấp, SP Pending, snapshot ví | SellerCenter |
| UC-70 | `GET /api/seller/reports?granularity=day\|week\|month&from=&to=` — series + totals + top SP; COGS từ `OrderItemLotAllocations` (BR-C05/C06); mặc định 30 ngày, tối đa 366 | SellerCenter |
| UC-85 | `GET /api/seller/wallet?txType=&page=&pageSize=` — Available (ledger) + Pending (đơn Paid…Delivered chưa Completed) + lịch sử `WalletTransactions` phân trang | SellerCenter |
| UC-87 | `POST /api/seller/vouchers` — create Scope=Shop voucher for seller's shop | SellerCenter |
| UC-88 | `PUT /api/seller/vouchers/{id}` — update shop voucher; `PATCH .../status` activate/disable | SellerCenter |
| UC-89 | `DELETE /api/seller/vouchers/{id}` — hard-delete when unused; `GET /api/seller/vouchers`, `GET .../{id}` list/detail | SellerCenter |

### 6.4 Order & Payment
| UC | Endpoint | Module |
|----|----------|--------|
| UC-29 | `GET /api/cart` — items, qty, unit price snapshot, subtotal | Order |
| UC-30 | `POST /api/cart/items` — body `{ productId, quantity }`; merge qty nếu trùng | Order |
| UC-31 | `PATCH /api/cart/items/{cartItemId}` (set qty); `DELETE /api/cart/items/{cartItemId}` | Order |
| UC-32 | `GET /api/vouchers?cartItemIds=&scope=&shopId=&page=&pageSize=` — list System + Shop vouchers (active period) with eligibility vs cart | Order |
| UC-33 | `POST /api/vouchers/preview` — preview discount (min order, limit, scope); apply at `POST /api/orders` via `vouchers: [{ shopId, voucherId }]` | Order |
| UC-34 | `POST /api/orders` | Order |
| UC-35 | `POST /api/payments/payos/create` + `POST /api/payments/payos/webhook`; `POST /api/payments/payos/confirm-webhook` (Admin) — register public webhook URL with payOS (needed for local/dev via ngrok) | Payment |
| UC-39 | `GET /api/orders?status=&page=&pageSize=` — buyer purchased orders (paged, newest first) | Order |
| UC-40 | `GET /api/orders/{orderId}` — detail: items, payment, tracking, status history, shipping snapshot | Order |
| UC-41 | `POST /api/orders/{orderId}/cancel` — only `PendingPayment` (BR-O01); release reserved stock; cancel pending payment | Order |
| UC-42 | `POST /api/orders/{orderId}/confirm-received` — only `Delivered` → `Completed` (BR-O02); credit seller wallet `OrderCredit` (BR-W01) | Order |
| UC-43 | `POST /api/orders/{orderId}/returns` — body `{ reason, description?, items?, evidences[] }` (≥1 Unboxing + ≥1 Testing); `GET /api/orders/{orderId}/returns`; ResolutionType=`ReturnRefund` only (BR-R01..R02); order → `ReturnRequested` | Order |

### 6.5 Admin
| UC | Endpoint | Module |
|----|----------|--------|
| UC-18 | `GET /api/admin/products?status=&q=&page=&pageSize=` (default `status=Pending`; `status=all`; paged + status summary); `GET .../{id}` | Admin |
| UC-19 | `POST /api/admin/products/{id}/approve` → Pending→Approved + moderation history + PublishedAt | Admin |
| UC-20 | `POST /api/admin/products/{id}/reject` + `reason` → Pending→Rejected + history | Admin |
| UC-21 | `GET /api/admin/products/{id}/moderation-history` — timeline Approve/Reject | Admin |
| UC-22..25 | Categories: `GET /api/admin/categories?q=&page=&pageSize=` (paged + summary); `GET /api/admin/categories/options` (parent select); CRUD | Admin |
| UC-48 | `GET /api/admin/return-requests?status=&q=&page=&pageSize=` (default `status=Pending`; `status=all`; paged + status summary) | Admin |
| UC-49 | `GET /api/admin/return-requests/{id}` — reason, Unboxing/Testing evidences, order lines, status history | Admin |
| UC-50 | `POST /api/admin/return-requests/{id}/approve`; `POST .../reject` + `adminNote` (required, BR-R03) | Admin |
| UC-52 | `POST /api/admin/return-requests/{id}/status` — body `{ status, note?, refundToBin?, refundToAccountNumber? }`; transitions `Approved→Receiving→Refunded→Closed`; on `Refunded`: payOS **payout (chi hộ)** refund to buyer bank + mark payment Refunded + `WalletTransactions.RefundDebit` (BR-R04; wallet may go negative). Bank account from webhook counter account or request override. | Admin |
| UC-71 | `GET /api/admin/insights/customers?from=&to=&granularity=` — KPIs, registration/order series, top products, simple new/returning buyer cohort (default last 30 days, granularity=day) | Admin |
| UC-72 | `GET /api/admin/accounts?status=&role=&q=&page=&pageSize=` (default status/role=`all`; paged + Active/Locked/role summary); `GET .../{id}` | Admin |
| UC-73 | `POST /api/admin/accounts/{id}/lock` → Status=Locked (cannot lock self or Admin accounts) | Admin |
| UC-74 | `POST /api/admin/accounts/{id}/unlock` → Status=Active (+ clear temporary login lockout) | Admin |
| UC-75 | `GET /api/admin/seller-registrations?status=&q=&page=&pageSize=` (default `status=Pending`; `status=all`; paged + status summary); `GET .../{id}` | Admin |
| UC-76 | `POST /api/admin/seller-registrations/{id}/approve` → role Seller + Shop + Wallet; `POST .../reject` + `adminNote` | Admin |
| UC-78 | `POST /api/admin/vouchers` — create Scope=System voucher | Admin |
| UC-79 | `PUT /api/admin/vouchers/{id}` — update conditions / period | Admin |
| UC-80 | `DELETE /api/admin/vouchers/{id}` — hard-delete when unused; otherwise disable | Admin |
| UC-81 | `PATCH /api/admin/vouchers/{id}/status` — activate / disable; `GET /api/admin/vouchers`, `GET .../{id}` list/detail (paged) | Admin |

### 6.6 Engagement
| UC | Endpoint / Hub | Module |
|----|----------------|--------|
| UC-36 | `GET /api/wishlist?page=&pageSize=` — buyer wishlist (paged, newest first); includes price, availability, shop | Engagement |
| UC-37 | `POST /api/wishlist/items` — body `{ productId }`; unique user+product; only Approved + active shop/category | Engagement |
| UC-38 | `DELETE /api/wishlist/items/{wishlistItemId}`; `DELETE /api/wishlist/products/{productId}` | Engagement |
| UC-59 | `GET /api/products/{productId}/reviews?page=&pageSize=&rating=` — visible reviews (paged); includes avg/count + optional sentiment fields | Engagement |
| UC-60 | `POST /api/products/{productId}/reviews` — body `{ orderId, rating, title?, content }`; Completed order containing product; unique buyer+product+order | Engagement |
| UC-61 | `PUT /api/reviews/{reviewId}` — owner update within 30 days | Engagement |
| UC-62a | `DELETE /api/reviews/{reviewId}` — owner soft-hide (`IsVisible=false`); recalc product AvgRating/ReviewCount | Engagement |
| UC-63 | `POST /api/seller-ratings` — body `{ shopId, orderId, score, comment? }`; Completed order of shop; unique buyer+shop+order; updates Shop.AvgRating/RatingCount | Engagement |
| UC-65 | `POST /api/follows/shops` — body `{ shopId }`; unique buyer+shop; only Active shop; cannot follow own shop; updates Shop.FollowerCount | Engagement |
| UC-66 | `DELETE /api/follows/shops/{shopId}` — unfollow; recalc Shop.FollowerCount | Engagement |
| UC-67 | `GET /api/follows?page=&pageSize=` — buyer followed shops (paged, newest first) | Engagement |
| UC-44 | `GET /api/notifications?page=&pageSize=&unreadOnly=` — inbox (paged, newest first); `GET /api/notifications/unread-count`; `POST /api/notifications/{id}/read`; `POST /api/notifications/read-all`; SignalR `NotificationHub` group `user:{userId}` event `ReceiveNotification` | Engagement |
| UC-45 | `DELETE /api/notifications/{notificationId}` — owner hard-delete | Engagement |
| UC-57 | `GET /api/chat/threads?page=&pageSize=` — thread list for buyer or shop owner (paged, by `LastMessageAt`); `GET /api/chat/threads/{threadId}`; `GET /api/chat/threads/{threadId}/messages?page=&pageSize=` — message window (page 1 = newest chunk, chronological within page) | Engagement |
| UC-58 | `POST /api/chat/threads` — open/get-or-create `{ shopId, productId? }` (buyer); `POST /api/chat/threads/{threadId}/messages` — `{ content, attachmentUrl? }`; `POST /api/chat/threads/{threadId}/read`; SignalR `ChatHub` group `thread:{threadId}` event `ReceiveMessage` (+ `JoinThread`/`LeaveThread`) | Engagement |

### 6.7 AI
| UC | Endpoint | Module |
|----|----------|--------|
| UC-53 | `GET /api/recommendations?page=&pageSize=` — hybrid recommendations (stored + collaborative + content affinity + popular); personalized when authenticated, popular fallback for guests | AI |
| UC-54 | `GET /api/products/{id}/similar?limit=` — content-similar Approved products (category/brand/tags/price) | AI |
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
| `shop:detail:{hash}` | ngắn | UC-62b |
| `shop:rating:{key}` | ngắn | UC-64 |
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
| Return | ReturnRequests, ReturnRequestItems, ReturnEvidences, ReturnStatusHistories |
| Engagement | WishlistItems, ProductReviews, SellerRatings, SellerFollows, Notifications, ChatThreads, ChatMessages |
| Seller finance | Shops, Wallets, WalletTransactions |
| Admin seller onboarding | SellerRegistrationRequests |
| AI | ViewedProductHistories, ProductRecommendations, AiConversations, AiMessages |

---

## 12. Non-goals (MVP)

- Không tích hợp GHN/GHTK tracking API (seller nhập tracking thủ công).
- Không AI auto-resolve tranh chấp return phức tạp.
- **Không Exchange / Đổi hàng** — chỉ Return & Refund; evidence Unboxing + Testing bắt buộc (xem `bussiness-system.md` BR-R01..R05).
- Không tách microservices giai đoạn MVP (giữ modular monolith).

---

## 13. Tài liệu liên quan

- `bussiness-system.md` — nghiệp vụ & UC
- `database.sql` — schema SQL Server
- `architecture-aidr-fe.md` — frontend
- Report7 — System Design §1.1 / Table 21

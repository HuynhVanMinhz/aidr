# AIDR Frontend Architecture (`aidr-fe`)

**Project:** AIDR - AI-Integrated Digital Retail  
**UI:** React · **State:** Redux · **Media:** Cloudinary · **API:** HTTPS → NGINX / .NET · **Realtime:** SignalR client

---

## 1. Mục tiêu kiến trúc

`aidr-fe` là SPA phục vụ Guest / Buyer / Seller / Admin. FE chịu trách nhiệm:
- Render UI & điều hướng theo role
- Cache state client (Redux) để giảm gọi API lặp
- Upload ảnh trực tiếp lên **Cloudinary**
- Gọi REST API backend qua HTTPS
- Nhận push realtime (chat, notification) qua SignalR

FE **không** chứa business rule thanh toán / duyệt sản phẩm - chỉ gọi BE.

---

## 2. Vị trí trong System Architecture

```
┌──────────────── aidr-fe ────────────────┐
│  React  ◄──CACHING──►  Redux            │
│    │                                    │
│    └──UPLOAD IMAGE──► Cloudinary        │
└──────────────│──────────────────────────┘
               │ HTTPS
               ▼
         NGINX + Keycloak + .NET (+ SignalR)
```

| Thành phần | Vai trò FE |
|------------|------------|
| **React** | UI components, pages, hooks |
| **Redux** | Global state + client cache (auth, cart, catalog slices) |
| **Cloudinary** | Upload ảnh sản phẩm / avatar (UC-13, UC-08) |
| **HTTPS / Axios** | Gọi AIDR API |
| **SignalR client** | Chat & notifications |

---

## 3. Package structure (theo SDD Table 20)

```
aidr-fe/
├── src/
│   ├── app/                 # App shell, router, providers, auth guards
│   ├── views/               # Pages + feature UI
│   │   ├── auth/
│   │   ├── catalog/
│   │   ├── cart-checkout/
│   │   ├── account/
│   │   ├── seller/
│   │   ├── admin/
│   │   ├── chat/
│   │   └── ai/
│   ├── components/          # Shared UI (layout, product card, forms…)
│   ├── store/               # Redux store + slices
│   │   ├── authSlice
│   │   ├── userSlice
│   │   ├── cartSlice
│   │   ├── catalogSlice
│   │   ├── notificationSlice
│   │   ├── chatSlice
│   │   └── adminSlice
│   ├── services/            # Axios API modules (domain-aligned)
│   ├── realtime/            # SignalR connection helpers
│   ├── hooks/               # useAuth, useCart, useDebounceSearch…
│   ├── utils/
│   ├── assets/
│   └── styles/
├── public/
└── package.json
```

**Theme tham khảo:** storefront `theme-for-aidr-fe/`; Admin & Seller `theme-for-aidr-admin-fe/admin/` (CSS trong `aidr-fe/public/admin-theme`).

---

## 4. Routing & Role Guard

| Area | Path prefix | Roles |
|------|-------------|-------|
| Public catalog | `/`, `/products`, `/products/:id`, `/shops/:shopKey`, `/categories` | Guest+ |
| Auth | `/login`, `/register`, `/forgot-password` | Guest |
| Buyer account | `/account/*`, `/cart`, `/checkout`, `/wishlist`, `/orders` | Buyer (+Seller nếu dual-role) |
| AI | Floating shopping assistant widget (all storefront pages) + compare page | Buyer |
| Chat | `/chat` (buyer), `/seller/chat` (seller) | Buyer / Seller |
| Seller center | `/seller`, `/seller/reports`, `/seller/wallet`, `/seller/products`, … | Seller |
| Admin | `/admin/*` | Admin |

**Guard flow:**
1. Đọc token từ storage / Redux.
2. Nếu thiếu → redirect `/login?returnUrl=...`.
3. Decode roles (JWT) → chặn route không đủ quyền.
4. 401 từ API → refresh token; fail → logout (UC-04).

---

## 5. State management (Redux = Caching)

| Slice | Dữ liệu cache | UC liên quan |
|-------|---------------|--------------|
| `auth` | accessToken, refresh, roles, session flags | UC-01..06 |
| `user` | profile, addresses | UC-07/08 |
| `catalog` | product lists, filters, category tree | UC-09..11, 26, 27, 90 |
| `recommendation` | home recommendations + similar-by-product cache | UC-53, UC-54 |
| `ai` | NL filter last result; compare selection tray (localStorage) + compare result; shopping-assistant conversations/messages | UC-90, UC-28, UC-56 |
| `shop` | public shop detail, seller rating, shop products | UC-62b, UC-64 |
| `cart` | items, qty, unit price snapshot, subtotal; cleared on logout | UC-29..31 |
| `voucher` | available vouchers + applied preview per shop; cleared on logout / cart clear | UC-32/33 |
| `orders` | buyer order list/detail cache | UC-39..42 |
| `sellerOrders` | seller shop order list/detail cache | UC-46/47 |
| `wishlist` | product ids | UC-36..38 |
| `notifications` | inbox + unread count | UC-44/45 |
| `chat` | threads + active messages window | UC-57/58 |
| `sellerFinance` | dashboard KPIs, sales report, wallet ledger | UC-69, 70, 85 |
| `seller` | my products, inventory & pricing | UC-16, 17, 91, 92 |
| `admin` | moderation queues | UC-18..25, 75..76 |
| `adminGovernance` | accounts list/detail, lock/unlock, customer insights | UC-71..74 |
| `adminVoucher` | system voucher list/detail cache | UC-78..81 |
| `sellerVoucher` | seller shop voucher list/detail cache | UC-87..89 |

**Caching rules:**
- List/search: giữ theo `queryKey` (q + filters + sort + page); stale-time ngắn.
- Mutation (add cart, update product) → invalidate slice liên quan.
- Không cache dữ liệu thanh toán nhạy cảm lâu trên client.

---

## 6. API Client layer

- Axios instance `baseURL` trỏ gateway NGINX.
- Interceptor: gắn `Authorization: Bearer <token>`.
- Chuẩn hóa lỗi ProblemDetails → toast / form errors.
- Service modules mirror BE domains:

| Service file | UC nhóm |
|--------------|---------|
| `authApi.ts` | UC-01..06 |
| `profileApi.ts` | UC-07/08 |
| `productApi.ts` | UC-09..11, 26, 27 (public catalog) |
| `sellerProductApi.ts` | UC-12..16 (seller CRUD + images) |
| `sellerInventoryApi.ts` | UC-17, UC-91, UC-92 (inventory, lots, selling price) |
| `categoryApi.ts` | UC-11, 22..25 (admin list server-paged + options) |
| `cartApi.ts` | UC-29..31 |
| `voucherApi.ts` | UC-32/33, 78..81, 87..89 |
| `orderApi.ts` | UC-34, 39..47 |
| `paymentApi.ts` | UC-35 |
| `returnApi.ts` | UC-43, 48..52, 93..95 |
| `wishlistApi.ts` | UC-36..38 |
| `notificationApi.ts` | UC-44/45 |
| `chatApi.ts` | UC-57/58 |
| `reviewApi.ts` | UC-59..62a |
| `sellerFinanceApi.ts` | UC-69, 70, 85 (dashboard, reports, wallet) |
| `sellerApi.ts` | UC-62b..67 (public shop read) |
| `adminApi.ts` | UC-18..21, 71..76 (seller registrations list is server-paged) |
| `aiApi.ts` | UC-28, 53, 54, 56, 90 |

---

## 7. Cloudinary upload (UC-13, avatar)

1. FE lấy upload signature / preset từ BE (hoặc unsigned preset dev).
2. `POST` multipart thẳng tới Cloudinary (không đi qua .NET body lớn).
3. Nhận `secure_url` + `public_id` → gửi kèm payload Create/Update Product / Profile.
4. Preview ảnh local trước khi confirm.

---

## 8. Realtime (SignalR)

| Hub (BE) | FE hành vi |
|----------|------------|
| `NotificationHub` | tăng unread badge; prepend list (UC-44) |
| `ChatHub` | append message vào thread active (UC-58) |

Kết nối sau khi auth thành công; reconnect với token mới khi refresh.

---

## 9. UI flows theo Actor

### 9.1 Guest
- Xem list/detail/category, search & filter (UC-09..11, 26, 27).
- Xem reviews / seller rating (UC-59, 64).
- CTA login khi Add to cart / wishlist / AI.

### 9.2 Buyer
- Cart → Apply voucher → Checkout → redirect payOS → return URL order status.
- Orders: cancel / confirm received / request return.
- AI Assistant page; Compare selected products; NL search bar → `nl-filter` → apply vào catalog filters.
- Chat với shop; follow seller; reviews.

### 9.3 Seller
- Seller layout riêng: My Products, Inventory, Orders, Vouchers, Wallet, Dashboard/Reports.
- Create product wizard + Cloudinary multi-image.
- Update order status với tracking code.

### 9.4 Admin
- Queues: Pending products, Seller registrations, Return requests.
- Category & System voucher management.
- Account lock/unlock; Customer insights charts (ApexCharts) + Flatpickr date filters (data từ BE).

---

## 10. AI UX notes

| UC | UX |
|----|-----|
| UC-90 | Ô “Tìm bằng ngôn ngữ tự nhiên” → BE trả filter JSON → bind vào filter panel |
| UC-28 | Chọn 2–N sản phẩm → panel kết quả so sánh (bảng + tóm tắt AI) |
| UC-56 | Floating chatbot (bottom-right) on storefront; page context (PDP/compare); slot chips; **quick-reply chips + “Question n/3” + “Skip questions” cho luồng tư vấn dẫn dắt**; product card có badge Best match / Cheaper option / Step up; deep-link product cards + “See all” / Compare CTAs |
| UC-53/54 | Section “Dành cho bạn” / “Sản phẩm tương tự” trên home & detail |

Loading & empty states bắt buộc; không block toàn app khi LLM chậm (timeout + fallback message).

---

## 11. Non-functional trên FE

| NFR | Cách đáp ứng |
|-----|----------------|
| Performance | Code-split routes; lazy pages Seller/Admin; image CDN Cloudinary |
| Security | Không lưu password; token httpOnly cookie nếu BE hỗ trợ, hoặc memory + refresh; sanitize HTML AI content |
| Accessibility | Form labels, focus states, keyboard cart/checkout |
| i18n (optional) | Chuẩn bị namespace `vi` mặc định |
| Responsive | Mobile-first cho catalog/cart; desktop cho Seller/Admin tables |

---

## 12. Environment config

```bash
VITE_API_BASE_URL=https://api.aidr.local
VITE_KEYCLOAK_URL=...
VITE_KEYCLOAK_REALM=aidr
VITE_KEYCLOAK_CLIENT_ID=aidr-fe
VITE_CLOUDINARY_CLOUD_NAME=...
VITE_CLOUDINARY_UPLOAD_PRESET=...
VITE_SIGNALR_HUB_URL=https://api.aidr.local/hubs
```

---

## 13. Mapping màn hình chính ↔ UC

| Screen | UC |
|--------|-----|
| Login / Register / Forgot | UC-01..05 |
| Profile / Security | UC-06..08 |
| Product list / detail / categories | UC-09..11 |
| Shop public page (seller detail + rating) | UC-62b, UC-64 |
| Search results + filter bar | UC-26, 27, 90 |
| Seller product form | UC-12..17 |
| Admin moderation / categories | UC-18..25 |
| Admin product moderation list / review | UC-18..21 |
| Admin seller registration queue / review | UC-75, UC-76 |
| Become a seller (buyer apply) | UC-77 (`/account/become-seller`, `sellerRegistrationApi`) |
| Cart / Checkout | UC-29..31 (`/cart`, `cartApi`); UC-32/33 (`voucherApi`, `voucherSlice`, apply on cart + checkout + `/account/vouchers`); UC-34 (`/checkout`, `orderApi` + `vouchers` on create); UC-35 (`paymentApi`, payOS + `/order-received`) |
| My orders / detail | UC-39..43 (`/account/orders`, `/account/orders/:orderId`, `ordersSlice` + `returnsSlice` / `returnApi`, cancel + confirm received + request return with Unboxing/Testing evidence) |
| My returns | UC-43 (`/account/returns`, `/account/returns/:returnId`, `GET /api/returns`; ReturnRefund\|Exchange) |
| Wishlist | UC-36..38 (`/wishlist` → `/account/wishlist`, `wishlistApi`, `wishlistSlice`, add/remove on catalog + detail) |
| Following | UC-65..67 (`/following` → `/account/following`, `followApi`, `followSlice`, follow/unfollow on shop page + list) |
| Notifications | UC-44/45 (`/account/notifications`, `/seller/notifications`, `notificationApi`, `notificationSlice`, SignalR `NotificationHub` → unread badge + prepend inbox) |
| Seller orders | UC-46/47 (`/seller/orders`, `/seller/orders/:orderId`, `sellerOrdersSlice`, update status + tracking) |
| Seller returns | UC-93..95 (`/seller/returns`, `/seller/returns/:id`, confirm → receiving → accept; notify Admin on Accepted) |
| Seller shop settings / alerts | `/seller/shop-settings`, `/seller/alerts` (`sellerApi` shop GET/PUT; inventory low-stock) |
| Admin returns | UC-48..52 (`/admin/return-requests`, approve→forward Seller; after Accepted: Refunded\|Exchanged→Closed) |
| Admin orders / dashboard | `/admin/orders`, `/admin/dashboard` KPI (`adminApi`) |
| Recommend / Similar blocks | UC-53/54 (`RecommendedProductsSection` on home; `SimilarProductsSection` on product detail; `aiApi` + `recommendationSlice`) |
| NL filter + Compare | UC-90 (`NlSearchBar` on `/products` → `POST /ai/nl-filter` → bind catalog filters); UC-28 (compare icon on card/detail → tray → `/compare` + `POST /ai/compare`, Buyer) |
| AI chatbot | UC-56 (`ShoppingAssistantWidget` in `AppShell`, `aiApi` chat + conversations) |
| Chat list / room | UC-57/58 (`/chat`, `/seller/chat`, `chatApi`, `chatSlice`, SignalR `ChatHub` → `ReceiveMessage` / `ThreadRead` / `Typing` on the per-user group, so every thread stays live; open via `?shopId=&productId=` / `?threadId=`; photos upload to Cloudinary folder `chat`, shared products travel as `/products/{id}` links rendered via `products/lookup`) |
| Reviews / Seller profile / Follow | UC-59..63 (`reviewApi`, `reviewSlice`, product detail reviews tab; order detail review + seller rating when Completed); UC-65..67 (`followApi`, `followSlice`, shop page follow + `/account/following`) |
| Seller dashboard / reports / wallet / shop vouchers | UC-69, 70, 85; UC-87..89 (`/seller/vouchers`, `voucherApi` seller + `sellerVoucherSlice`, create/edit/status/delete) |
| Admin accounts / seller requests / system vouchers / insights | UC-71..81 (`/admin/accounts`, `/admin/accounts/:id`, `/admin/insights`, `adminApi` accounts+insights + `adminGovernanceSlice`; `/admin/vouchers`, `voucherApi` admin + `adminVoucherSlice`) |
| Help / FAQ / Terms / 404 / 403 | Static storefront + error pages |
---

## 14. Tài liệu liên quan

- `bussiness-system.md` - nghiệp vụ & UC
- `database.sql` - schema (FE chỉ consume qua API)
- `architecture-aidr-be.md` - backend contracts & hubs
- `theme-for-aidr-fe/` - HTML theme storefront
- `theme-for-aidr-admin-fe/` - HTML theme Admin / Seller
- Report7 - System Design §1.1 / Table 20

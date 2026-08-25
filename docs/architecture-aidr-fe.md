# AIDR Frontend Architecture (`aidr-fe`)

**Project:** AIDR — AI-Integrated Digital Retail  
**UI:** React · **State:** Redux · **Media:** Cloudinary · **API:** HTTPS → NGINX / .NET · **Realtime:** SignalR client

---

## 1. Mục tiêu kiến trúc

`aidr-fe` là SPA phục vụ Guest / Buyer / Seller / Admin. FE chịu trách nhiệm:
- Render UI & điều hướng theo role
- Cache state client (Redux) để giảm gọi API lặp
- Upload ảnh trực tiếp lên **Cloudinary**
- Gọi REST API backend qua HTTPS
- Nhận push realtime (chat, notification) qua SignalR

FE **không** chứa business rule thanh toán / duyệt sản phẩm — chỉ gọi BE.

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
| AI | `/ai/assistant`, compare modal/page | Buyer |
| Chat | `/chat` | Buyer / Seller |
| Seller center | `/seller`, `/seller/products`, `/seller/products/new`, `/seller/products/:id`, `/seller/products/:id/edit`, `/seller/inventory`, `/seller/products/:id/inventory` | Seller |
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
| `shop` | public shop detail, seller rating, shop products | UC-62b, UC-64 |
| `cart` | items, applied voucher preview | UC-29..33 |
| `orders` | buyer order list/detail cache | UC-39..42 |
| `wishlist` | product ids | UC-36..38 |
| `notifications` | inbox + unread count | UC-44/45 |
| `chat` | threads + active messages window | UC-57/58 |
| `seller` | my products, inventory & pricing, dashboard KPIs | UC-16, 17, 91, 92, 69, 70, 85 |
| `admin` | moderation queues, accounts | UC-18..25, 72..81 |

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
| `returnApi.ts` | UC-43, 48..52 |
| `wishlistApi.ts` | UC-36..38 |
| `notificationApi.ts` | UC-44/45 |
| `chatApi.ts` | UC-57/58 |
| `reviewApi.ts` | UC-59..62a |
| `sellerApi.ts` | UC-62b..67, 69, 70, 85 |
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
- Account lock/unlock; Customer insights charts (data từ BE).

---

## 10. AI UX notes

| UC | UX |
|----|-----|
| UC-90 | Ô “Tìm bằng ngôn ngữ tự nhiên” → BE trả filter JSON → bind vào filter panel |
| UC-28 | Chọn 2–N sản phẩm → panel kết quả so sánh (bảng + tóm tắt AI) |
| UC-56 | Chat UI; message streaming nếu BE hỗ trợ; deep-link tới product cards trong reply |
| UC-53/54 | Section “Dành cho bạn” / “Sản phẩm tương tự” trên home & detail |

Loading & empty states bắt buộc; không block toàn app khi Ollama chậm (timeout + fallback message).

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
| Cart / Checkout | UC-29..35 |
| Wishlist | UC-36..38 |
| My orders / detail | UC-39..43 |
| Notifications | UC-44/45 |
| Seller orders | UC-46/47 |
| Admin returns | UC-48..52 |
| Recommend / Similar blocks | UC-53/54 |
| AI chatbot | UC-56 |
| Chat list / room | UC-57/58 |
| Reviews / Seller profile / Follow | UC-59..67 |
| Seller dashboard / reports / wallet / shop vouchers | UC-69, 70, 85, 87..89 |
| Admin accounts / seller requests / system vouchers / insights | UC-71..81 |

---

## 14. Tài liệu liên quan

- `bussiness-system.md` — nghiệp vụ & UC
- `database.sql` — schema (FE chỉ consume qua API)
- `architecture-aidr-be.md` — backend contracts & hubs
- `theme-for-aidr-fe/` — HTML theme storefront
- `theme-for-aidr-admin-fe/` — HTML theme Admin / Seller
- Report7 — System Design §1.1 / Table 20

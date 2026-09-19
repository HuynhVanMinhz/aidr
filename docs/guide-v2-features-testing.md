# Hướng dẫn test tính năng AIDR v2

**Liên quan:** `docs/solution-v2-roadmap.md`  
**Phạm vi:** seed + smoke API + checklist UI cho các tính năng v2 (price history/alert, protection timeline, review digest, bundle, compatibility, reorder, follow feed, Q&A, shop badges, restock, KYC duplicate).

---

## 0. Groq thật hay mock?

Cấu hình Development hiện tại (`aidr-be/AIDR.Api/appsettings.Development.json`):

```jsonc
"Groq": {
  "BaseUrl": "https://api.groq.com/openai/v1",
  "ApiKey": "<your-key>",
  "Model": "openai/gpt-oss-120b",
  "UseMock": false
}
```

| Tính năng | Gọi Groq? | Ghi chú |
|-----------|-----------|---------|
| **AI Review Digest** | Có (khi generate mới) | `source: "Groq"` nếu thành công; fallback `Heuristic` nếu timeout/parse lỗi. Seed/snapshot cũ có thể trả cache **không** gọi lại Groq. |
| **Compatibility check** | Có điều kiện | Ưu tiên **rule** trên specs. Chỉ gọi Groq khi rule trả `Unknown` và `UseMock=false`. Response có `source: "Groq"` hoặc `"Rule"`. |
| **Smart accessory bundle** | Không | Rule JSON + catalog / similar products (`source: "Rule"`). |
| **Restock advisor** | Không | Thống kê bán hàng / tồn kho (SQL). |
| Price history, price alert, protection timeline, reorder, follow feed, Q&A, shop badges, KYC duplicate | Không | Logic DB / background job, không LLM. |

**Cách xác nhận Groq đang chạy thật:**

1. `Groq:UseMock` = `false` và `ApiKey` không rỗng.
2. Trong response digest / compatibility xem field `source`.
3. Log API: khi gọi LLM thành công không thấy dòng kiểu `falling back to heuristic (no Groq response)`.
4. Network tab DevTools → request tới backend (không gọi trực tiếp `api.groq.com` từ browser; FE chỉ gọi AIDR API).

> Seed `seed-review-digest` có thể ghi sẵn snapshot → lần GET đầu **không** hit Groq. Để buộc regenerate: thêm review mới (đổi `reviewCount`) hoặc xóa snapshot trong `ProductReviewDigestSnapshots` rồi gọi lại API (trong giới hạn regenerate/giờ).

---

## 1. Chuẩn bị môi trường

### 1.1 Backend

```powershell
cd e:\WorkSpace\aidr\aidr-be
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --project AIDR.Api --urls "http://localhost:5080"
```

- SQL Server local (port **1433**) cần chạy.
- Redis (6379) **không bắt buộc** nếu `Caching:UseInMemory: true`.
- Health: `GET http://localhost:5080/api/health/live`

### 1.2 Frontend

```powershell
cd e:\WorkSpace\aidr\aidr-fe
npm run dev
# http://localhost:5173
```

### 1.3 Tài khoản demo

| Role | Email | Password |
|------|-------|----------|
| Buyer | `buyer@aidr.local` | `Aidr@123` |
| Seller | `seller@aidr.local` | `Aidr@123` |
| Admin | `admin@aidr.local` | `Aidr@123` |

### 1.4 Catalog đa dạng (leaf categories)

Nếu sidebar category còn leaf = 0 hoặc catalog quá ít:

```powershell
Invoke-RestMethod -Method Post "$Base/dev/seed-categories"
Invoke-RestMethod -Method Post "$Base/dev/seed-catalog-rich"   # ~78 SKU + remap leaf
Invoke-RestMethod -Method Post "$Base/dev/seed-inventory-lots"
```

Reload `/products` - leaf như Apple iPhone, Gaming Laptops, Chargers & Cables… sẽ có count > 0.

---

## 2. Seed dữ liệu v2

Chỉ chạy khi API đang Development (`IsDevelopment()`).

```powershell
$Base = "http://localhost:5080/api"

# Nền (nếu DB trống)
Invoke-RestMethod -Method Post "$Base/dev/seed-demo-accounts"
# seed-catalog: chỉ chạy khi chưa có product (chạy lại dễ lỗi duplicate PK)
Invoke-RestMethod -Method Post "$Base/dev/seed-inventory-lots"

# v2
Invoke-RestMethod -Method Post "$Base/dev/seed-price-alerts"
Invoke-RestMethod -Method Post "$Base/dev/seed-review-digest"
Invoke-RestMethod -Method Post "$Base/dev/seed-bundle-demo"
Invoke-RestMethod -Method Post "$Base/dev/seed-product-qa"
Invoke-RestMethod -Method Post "$Base/dev/seed-reorder-demo"
Invoke-RestMethod -Method Post "$Base/dev/seed-kyc-duplicate"
```

Nếu DB chưa có bảng mới, chạy SQL trước:

- `scripts/price-alert-schema.sql`
- `scripts/review-digest-schema.sql`
- `scripts/product-qa-schema.sql`

### Smoke test tự động

```powershell
powershell -ExecutionPolicy Bypass -File e:\WorkSpace\aidr\scripts\smoke-test-v2.ps1
```

Kỳ vọng: **26 passed, 0 failed**.

---

## 3. Checklist UI theo tính năng

### 3.1 Price history + price alert (buyer)

| Bước | Làm gì | Kỳ vọng |
|------|--------|---------|
| 1 | Login buyer → mở PDP có lịch sử giá (sau `seed-price-alerts`) | Section chart / điểm giá gần đây |
| 2 | Bật toggle price drop / back-in-stock | API `GET/POST /api/price-alerts/...` 200; trạng thái lưu lại sau reload |
| 3 | (Tuỳ chọn) Đợi/background `PriceAlertBackgroundService` | Alert khi giá/tồn khớp điều kiện (xem log API) |

API nhanh:

```http
GET /api/products/{productId}/price-history?days=90
GET /api/price-alerts/products/{productId}/status
Authorization: Bearer <buyer-token>
```

### 3.2 Buyer protection timeline

| Bước | Làm gì | Kỳ vọng |
|------|--------|---------|
| 1 | Login buyer → **Account → Orders** → mở 1 đơn | Card timeline escrow / return / complete |
| 2 | So sánh với trạng thái đơn hiện tại | Các bước completed / current / upcoming khớp |

```http
GET /api/orders/{orderId}/protection-timeline
```

### 3.3 AI Review Digest

| Bước | Làm gì | Kỳ vọng |
|------|--------|---------|
| 1 | Mở PDP **Samsung Galaxy S24** (`/products/...` slug `samsung-galaxy-s24-256gb`) | Digest có summary, pros/cons, sentiment |
| 2 | DevTools → response `review-digest` | `available: true`, `reviewCount` ≥ ngưỡng; `source` = `Groq` hoặc `Heuristic` (hoặc snapshot seed) |
| 3 | SP ít review | `available: false` |

```http
GET /api/products/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/review-digest
```

### 3.4 Smart accessory bundle

| Bước | Làm gì | Kỳ vọng |
|------|--------|---------|
| 1 | Mở PDP điện tử (phone / laptop sau `seed-bundle-demo`) | Section “Frequently bought together” / bundle items |
| 2 | Kiểm tra API | `items` ≥ 1, `source: "Rule"` - **không** phụ thuộc Groq |

```http
GET /api/products/{productId}/bundle
```

### 3.5 Compatibility check

| Bước | Làm gì | Kỳ vọng |
|------|--------|---------|
| 1 | Dùng pair seed: `compat-demo-laptop-ddr4` + `compat-demo-ram-ddr5-16gb` | Verdict rõ (thường **Incompatible** qua rule) |
| 2 | Free-text mơ hồ / thiếu specs | Có thể `Unknown` → khi đó mới gọi Groq; xem `source` |
| 3 | Network | Body `POST /api/ai/compatibility` |

```http
POST /api/ai/compatibility
Content-Type: application/json

{
  "primaryProductId": "<laptop-id>",
  "secondaryProductId": "<ram-id>"
}
```

hoặc:

```json
{
  "primaryProductId": "<product-id>",
  "freeTextDevice": "DDR5 laptop with USB-C"
}
```

### 3.6 One-click reorder

| Bước | Làm gì | Kỳ vọng |
|------|--------|---------|
| 1 | Seed reorder → login buyer → order detail | Nút **Buy again** / reorder |
| 2 | Bấm reorder | Items vào cart; toast/message success; `addedCount` > 0 |

```http
POST /api/orders/{orderId}/reorder
```

### 3.7 Following feed

| Bước | Làm gì | Kỳ vọng |
|------|--------|---------|
| 1 | Buyer follow shop (nếu chưa) | |
| 2 | Mở `/account/following/feed` | Feed sản phẩm / cập nhật từ shop đang follow |

```http
GET /api/following/feed?page=1&pageSize=10
```

### 3.8 Product Q&A

| Bước | Làm gì | Kỳ vọng |
|------|--------|---------|
| 1 | PDP có Q&A (sau seed, ví dụ `compat-demo-laptop-ddr4`) | Panel câu hỏi / trả lời |
| 2 | Buyer đăng câu hỏi mới | Xuất hiện trong list (theo moderation nếu có) |

```http
GET /api/products/{productId}/questions
```

### 3.9 Shop trust badges

| Bước | Làm gì | Kỳ vọng |
|------|--------|---------|
| 1 | Mở `/shops/{slug}` shop active | Mảng badges (Verified / Fast ship / … tuỳ dữ liệu) |

```http
GET /api/shops/{shopKey}
```

Field `badges` không được `null`.

### 3.10 Restock advisor (seller)

| Bước | Làm gì | Kỳ vọng |
|------|--------|---------|
| 1 | Login seller → **Inventory** | Card restock advice (không cần Groq) |
| 2 | API | `GET /api/seller/inventory/restock-advice?days=14` có `items` |

### 3.11 KYC duplicate warning (admin)

| Bước | Làm gì | Kỳ vọng |
|------|--------|---------|
| 1 | `seed-kyc-duplicate` | Có registration Pending trùng dấu hiệu |
| 2 | Login admin → **Seller registrations** → mở detail | Banner / warning duplicate |

---

## 4. Map nhanh: URL FE ↔ API

| UI | Route FE | API chính |
|----|----------|-----------|
| PDP price / digest / bundle / Q&A | `/products/:id` | `.../price-history`, `.../review-digest`, `.../bundle`, `.../questions` |
| Price alert toggles | PDP (logged in) | `/api/price-alerts/...` |
| Protection + reorder | `/account/orders/:orderId` | `.../protection-timeline`, `.../reorder` |
| Following feed | `/account/following/feed` | `/api/following/feed` |
| Compatibility | PDP / AI flow | `POST /api/ai/compatibility` |
| Shop badges | `/shops/:shopKey` | `GET /api/shops/{shopKey}` |
| Restock | `/seller/inventory` | `GET /api/seller/inventory/restock-advice` |
| KYC duplicate | `/admin/seller-registrations/:id` | admin registration detail |

---

## 5. Troubleshooting

| Hiện tượng | Nguyên nhân thường gặp | Xử lý |
|------------|------------------------|--------|
| Smoke `seed-catalog` 500 | Catalog đã seed, duplicate PK | Bỏ qua; script smoke đã skip nếu có product |
| Digest `available: false` | Ít hơn `ReviewDigest:MinReviews` | Chạy `seed-review-digest` / dùng S24 |
| Digest không đổi / không gọi Groq | Snapshot + cache còn khớp `reviewCount` | Thêm review hoặc xóa snapshot; restart API nếu cache in-memory |
| Compatibility luôn `Rule` | Specs đủ để rule quyết định | Đúng thiết kế; thử free-text thiếu key specs để thấy Groq |
| Bundle trống | Category không khớp `accessory-rules.json` | Chạy `seed-bundle-demo`; thử SP điện tử Approved |
| API 503 Groq | Thiếu ApiKey hoặc key hết hạn | Điền lại `Groq:ApiKey`, giữ `UseMock: false` |
| Redis connection error | Port 6379 tắt | Bật Redis hoặc `Caching:UseInMemory: true` |

---

## 6. Tài liệu liên quan

- `docs/solution-v2-roadmap.md`
- `docs/solution-price-alerts-and-history.md`
- `docs/solution-buyer-protection-timeline.md`
- `docs/solution-ai-review-digest.md`
- `docs/solution-ai-bundle-and-compatibility.md`
- `docs/solution-v2-engagement-growth.md`
- `docs/solution-v2-seller-trust.md`
- Script: `scripts/smoke-test-v2.ps1`

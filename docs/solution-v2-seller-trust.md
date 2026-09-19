# AIDR - Solution: Seller Trust & Pro Tools (v2)

**Status:** Implemented (Phase 4 scope)  
**Module:** SellerCenter, Admin, Engagement, AI  
**Phạm vi:** Badge uy tín seller, gợi ý nhập hàng, flash sale, AI hỗ trợ admin duyệt return - không thay BR core.

---

## 1. Danh sách tính năng

| # | Tính năng | Priority | Effort |
|---|-----------|----------|--------|
| 1 | **Seller Trust Badges** | P2 | M |
| 2 | **AI Restock Advisor** | P3 | M |
| 3 | **Flash Sale / Time-boxed price** | P2 | L |
| 4 | **Return Evidence AI Assist (Admin)** | P3 | L |
| 5 | **Duplicate Seller Detection (KYC)** | P2 | S |
| 6 | **Dynamic Pricing Suggestion** | P3 | M |

---

## 2. Seller Trust Badges

### Yêu cầu

Hiển thị badge trên **Shop public page** (UC-62b) và product cards:

| Badge | Rule (configurable) |
|-------|---------------------|
| Verified identity | Seller registration KYC `Passed` |
| Top rated | Shop avg rating ≥ 4.5, ≥ 20 ratings |
| Fast shipping | ≥90% orders Delivered within N days (30d window) |
| Responsive | Chat median reply < 4h (optional Phase B) |

### Implementation

- **Compute job nightly** → `ShopBadges (ShopId, BadgeCode, EarnedAt, ExpiresAt)` hoặc JSON column `Shops.BadgeCodesJson`.  
- FE: icon + tooltip English trên shop header.

### API

`GET /api/shops/{id}` response thêm `badges: [{ code, label, description }]`

Không hiển thị badge seller chưa đạt (chỉ positive badges).

---

## 3. AI Restock Advisor

### Yêu cầu

Seller dashboard widget **Restock suggestions**:

- Input: sales velocity 14/30 ngày từ UC-70, `StockQuantity`, low-stock threshold.  
- Output: list `{ productId, name, daysUntilStockout, suggestedQty, note }`.  
- Rule-first: `daysUntilStockout = stock / avgDailySales`; LLM chỉ viết `note` English ngắn.

### API

`GET /api/seller/inventory/restock-advice?days=14`

Reuse `SellerInventoryRepository` + order line aggregates - không ML v1.

---

## 4. Flash Sale / Time-boxed pricing

### Yêu cầu

- Seller (hoặc Admin system campaign) đặt `SalePrice` + `SaleStartsAt` / `SaleEndsAt`.  
- Job: tự revert về `BasePrice` khi hết giờ; notify followers (optional).  
- PDP countdown timer khi `now ∈ [start, end]`.

### Schema

Mở rộng `Products` hoặc bảng `ProductPromotions`:

```sql
ProductPromotions (PromotionId, ProductId, SalePrice, StartsAt, EndsAt, Status)
```

Conflict với UC-92: khi promotion active, effective price = promotion; khi end → ghi `ProductPriceHistories` reason `FlashSaleEnded`.

### Effort

L - cần job + seller form + discovery filter *On sale*.

---

## 5. Return Evidence AI Assist (Admin)

### Yêu cầu

Trên admin return detail (UC-49): panel **AI checklist** (advisory only):

- Video metadata / thumbnail frames (nếu có) - Phase B vision.  
- v1: parse buyer note + compare order line SKU vs reason text → flags: *"Mentioned wrong item"*, *"Missing unboxing keyword"*.

**Admin luôn quyết định** - không auto approve/reject (BR-R03).

### API

`GET /api/admin/returns/{id}/ai-assist` → `{ flags[], summary }`

Mock: keyword checklist English.

---

## 6. Duplicate Seller Detection (KYC)

### Yêu cầu

Khi admin duyệt seller registration: cảnh báo nếu `KycVerifications.IdDocumentNumberHash` trùng user khác đã có shop Approved.

### Schema

- Hash CCCD số (SHA-256 + salt server) - **không** lưu plaintext số CCCD mới nếu chưa có.  
- Index `UX_Kyc_IdHash` where not null.

Admin UI: banner *"This identity is linked to another account"* - không block auto, admin quyết.

Liên quan `solution-seller-onboarding-ekyc.md`.

---

## 7. Dynamic Pricing Suggestion

### Yêu cầu

Seller product edit: sidebar **Pricing insight**:

- So sánh `SalePrice` với median category (anonymous aggregate).  
- Margin vs `AvgCostPrice`: *"Margin 12% - below your shop average 18%"*.

Rule-only v1; không auto đổi giá.

---

## 8. Thứ tự implement

```
Duplicate KYC hash     →  nhỏ, tăng trust sàn sớm
Seller Badges          →  visible trên storefront
Restock Advisor        →  seller dashboard
Flash Sale             →  cần schema + job
Return AI Assist       →  admin optional
Pricing Suggestion     →  nice-to-have
```

---

## 9. Seed & dev

| Feature | Script / endpoint |
|---------|-------------------|
| Badges | `seed-shop-badges.sql` / `POST /api/dev/seed-shop-badges` |
| Flash sale | `seed-flash-sale.sql` |
| KYC duplicate | 2 registration cùng hash mock |

---

## 10. Acceptance (Phase 4 minimum)

- [ ] Shop KYC verified → badge visible on shop page.  
- [ ] Dashboard restock widget ≥1 suggestion khi low stock + có sales.  
- [ ] Admin thấy duplicate identity warning on registration detail.

Tách doc đầy đủ `solution-flash-sale.md` khi bắt đầu implement promotion engine.

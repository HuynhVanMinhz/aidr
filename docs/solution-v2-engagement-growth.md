# AIDR — Solution: Engagement & Growth Extensions (v2)

**Status:** Implemented (Phase 3 scope)  
**Module:** Order, Engagement, Notifications, Profile  
**Use case:** UC-68 (One-Click Reorder) + các UC mới (chưa gán số)  
**Phạm vi:** Tăng retention sau Phase 1–2; implement sau khi price alerts & AI bundle ổn.

---

## 1. Danh sách tính năng

| # | Tính năng | Priority | Effort |
|---|-----------|----------|--------|
| 1 | **One-Click Reorder** (UC-68) | P2 | M |
| 2 | **Follow Seller Feed** | P2 | M |
| 3 | **Product Q&A (public)** | P2 | L |
| 4 | **Personalized Homepage blocks** | P2 | M |
| 5 | **Abandoned Cart Reminder** | P3 | M |
| 6 | **Referral Program** | P3 | L |

---

## 2. UC-68 — One-Click Reorder

### Yêu cầu

- Từ `OrdersPage` / `OrderDetailPage`, nút **Buy again** trên đơn `Completed` (hoặc mọi đơn không cancel).  
- BE copy `OrderItems` → add cart: check SP still `Approved`, stock, **giá hiện tại** (không dùng snapshot giá cũ).  
- Partial success: item hết hàng → skip + message liệt kê.

### API

`POST /api/orders/{orderId}/reorder` → `{ addedCount, skippedItems[] }`

### Không làm

- Reorder tự động checkout / reuse voucher cũ.

---

## 3. Follow Seller Feed

### Yêu cầu

- Trang `/account/following/feed` — timeline SP mới + voucher shop từ shops đã follow (UC-65..67).  
- Sort: `CreatedAt DESC`; paginate.  
- Notify (optional): digest weekly *"3 new products from shops you follow"* — Type `Promo`.

### API

`GET /api/me/following/feed?page=&pageSize=`

Query: products `Approved` where `ShopId IN followed`, union shop vouchers active (dedupe card type).

### Schema

Không bắt buộc — query join `Follows`, `Products`, `Vouchers`.

---

## 4. Product Q&A (public)

### Yêu cầu

- Tab **Q&A** trên PDP — buyer hỏi, seller (owner shop) hoặc buyer đã mua trả lời.  
- Moderation: seller ẩn câu hỏi spam; admin queue (Phase B).  
- Khác chat 1-1 (UC-57): công khai, threaded per product.

### Schema (khi implement)

```sql
ProductQuestions (QuestionId, ProductId, UserId, Content, Status, CreatedAt)
ProductAnswers   (AnswerId, QuestionId, UserId, Content, IsOfficial, CreatedAt)
```

`IsOfficial=true` khi responder là shop owner.

### API sketch

- GET `/api/products/{id}/questions`  
- POST `/api/products/{id}/questions` (Buyer)  
- POST `/api/questions/{id}/answers` (Buyer/Seller)

---

## 5. Personalized Homepage

### Yêu cầu

- Block trên home (buyer login): **Continue browsing** (`ViewedProductHistories`), **Recommended for you** (UC-53), **From shops you follow**.  
- Guest: chỉ bestseller / category tiles (hiện có).

Reuse APIs — FE composition only Phase 1; BE aggregate endpoint `GET /api/me/home-feed` Phase 2.

---

## 6. Abandoned Cart Reminder (P3)

### Yêu cầu

- Job daily: cart updated >24h ago, user Active, chưa checkout → 1 notification Type `Promo`.  
- Dedupe 7 ngày / user.

Config: `Engagement:AbandonedCartHours=24`.

**Email:** out of scope v1 (in-app only).

---

## 7. Referral Program (P3)

### Yêu cầu

- Mỗi buyer có `ReferralCode`; người được mời nhập khi register (optional) → cả hai nhận voucher system sau first completed order referee.  
- Chống self-referral (same device/email pattern heuristic).

### Schema sketch

`ReferralCodes`, `ReferralRedemptions` — chi tiết khi Phase 3 chốt BR voucher.

---

## 8. Dependency & thứ tự

```
One-Click Reorder  →  không phụ thuộc AI
Follow Feed        →  Follow module Done
Q&A                →  schema mới
Homepage           →  Viewed + Recommend Done
Abandoned Cart     →  Notifications Done
Referral           →  Voucher system Done
```

---

## 9. Seed gợi ý (khi implement)

| Feature | Endpoint |
|---------|----------|
| Reorder demo | `POST /api/dev/seed-reorder-demo` |
| Follow feed | mở rộng seed follow + products |
| Q&A | `scripts/seed-product-qa.sql` |

---

## 10. Acceptance (Phase 3 minimum)

- [ ] Reorder completed order → cart có items available.  
- [ ] Feed hiện SP từ ≥1 shop followed.  
- [ ] Q&A: 1 question + seller answer visible on PDP.

Chi tiết API/FE bổ sung thành doc riêng khi bắt đầu từng tính năng (tách `solution-product-qa.md` nếu Q&A lớn).

# AIDR - Solution: Price Alerts & Public Price History

**Status:** Implemented  
**Module:** Engagement + Discovery + Notifications  
**Use case:** UC-51 (Manage Product Price Alerts), UC-55 (View Product Price History)  
**Liên quan:** UC-36..38 (Wishlist), UC-92 (Seller price history), UC-44 (Notifications)  
**Phạm vi:** Buyer xem biểu đồ giá công khai trên PDP; bật alert giá giảm / có hàng lại từ wishlist; nhận thông báo SignalR + inbox.

---

## 1. Yêu cầu nghiệp vụ

### 1.1 Price History (UC-55)

- Guest/Buyer xem **lịch sử giá bán** (effective price = `SalePrice ?? BasePrice`) trong 30 / 90 ngày trên PDP.  
- Chỉ hiển thị SP `Approved`; không lộ giá vốn lô (`UnitCost`).  
- Nguồn: `ProductPriceHistories` (đã ghi khi seller đổi giá UC-92).

### 1.2 Price Alerts (UC-51)

- Buyer (đã login) bật alert trên SP đang trong wishlist **hoặc** trực tiếp trên PDP.  
- Hai loại alert:
  - **PriceDrop** - giá effective giảm ≥ ngưỡng (mặc định 5% hoặc ≥ 50.000₫, lấy max).  
  - **BackInStock** - từ `StockQuantity = 0` → `> 0`.  
- Mỗi `(UserId, ProductId, AlertType)` tối đa 1 bản ghi active.  
- Notify qua `Notifications` + SignalR; dedupe trong 24h cho cùng SP + loại alert.  
- User tắt alert hoặc alert auto-expire sau 90 ngày nếu không tương tác.

### 1.3 Nguyên tắc

1. **Snapshot tại thời điểm subscribe** - lưu `BaselinePrice` / `BaselineInStock` khi tạo alert để so sánh job.  
2. **Không spam** - job chỉ fire khi vượt ngưỡng; dedupe notification.  
3. **Guest read-only history** - alert cần login.  
4. **Variant-aware (v2.1)** - v1 aggregate theo product; variant picker chưa có history riêng thì dùng product-level.

---

## 2. Hiện trạng & khoảng trống

| Đang có | Thiếu |
|---------|-------|
| `ProductPriceHistories` + ghi khi UC-92 | API/FE buyer **không** đọc history |
| `WishlistItems` | Không có alert flag / baseline |
| `NotificationService` + SignalR | Không type `PriceAlert` / `StockAlert` |
| `NotificationConstants.TypePromo` | Chưa dùng cho price drop |
| Seller inventory thay đổi stock | Không trigger buyer alert |

---

## 3. Schema đề xuất

Script: `scripts/price-alert-schema.sql` (idempotent).

```sql
CREATE TABLE dbo.ProductPriceAlerts (
    PriceAlertId    UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    UserId          UNIQUEIDENTIFIER NOT NULL,
    ProductId       UNIQUEIDENTIFIER NOT NULL,
    AlertType       NVARCHAR(20)     NOT NULL,  -- PriceDrop | BackInStock
    BaselinePrice   DECIMAL(18,2)    NULL,      -- required for PriceDrop
    ThresholdPct    DECIMAL(5,2)     NULL,      -- default 5.00
    ThresholdAmount DECIMAL(18,2)    NULL,      -- default 50000
    IsActive        BIT              NOT NULL DEFAULT 1,
    LastTriggeredAt DATETIME2(3)     NULL,
    ExpiresAt       DATETIME2(3)     NULL,
    CreatedAt       DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_PriceAlert_User_Product_Type UNIQUE (UserId, ProductId, AlertType),
    CONSTRAINT CK_PriceAlert_Type CHECK (AlertType IN (N'PriceDrop', N'BackInStock'))
);
```

**Không** thêm bảng price history - tái sử dụng `ProductPriceHistories`.

---

## 4. API

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/api/products/{id}/price-history?days=90` | Guest | Trả `{ points: [{ at, price }], currentPrice, lowestInPeriod, highestInPeriod }` |
| GET | `/api/me/price-alerts` | Buyer | List alert của user (paginated) |
| POST | `/api/me/price-alerts` | Buyer | Body `{ productId, alertType, thresholdPct?, thresholdAmount? }` |
| DELETE | `/api/me/price-alerts/{id}` | Buyer | Tắt alert |
| GET | `/api/products/{id}/price-alerts/status` | Buyer | `{ priceDrop: bool, backInStock: bool }` cho PDP toggle |

### 4.1 Price history aggregation

```
effectiveNew(t) = COALESCE(NewSalePrice, NewBasePrice) tại mỗi PriceHistory row
effectiveOld(t) = COALESCE(OldSalePrice, OldBasePrice) của row đầu trong cửa sổ
current         = product effective price now
points          = step function:
                  - đầu kỳ (since) → giá cũ trước lần đổi đầu tiên trong cửa sổ
                  - mỗi ChangedAt → giá mới
                  - thêm điểm "now" = current
```

Cache Redis key `product:price-history:{productId}:{days}` TTL 15 phút - invalidate khi UC-92 / product update ghi history mới.

---

## 5. Background job

`PriceAlertBackgroundService` (`IHostedService`), interval **15 phút** (config `PriceAlerts:JobIntervalMinutes`).

```
foreach active alert:
  if PriceDrop:
    current = effectivePrice(product)
    drop = baseline - current
    if drop >= max(baseline * thresholdPct, thresholdAmount):
      if LastTriggeredAt is null OR > 24h ago:
        CreateNotification(TypePromo, RefProduct)
        push SignalR
        update LastTriggeredAt
        optional: refresh BaselinePrice = current  (chỉ alert lần giảm tiếp theo)

  if BackInStock:
    if baseline was out-of-stock AND stock > 0:
      same notify + dedupe
```

**Trigger khi seller đổi giá:** hook nhẹ trong `SellerInventoryRepository` sau insert `ProductPriceHistories` - enqueue productId vào in-memory channel (optional v1.1) để job chạy sớm hơn 15 phút.

---

## 6. Frontend

| Màn | Thay đổi |
|-----|----------|
| `ProductDetailPage` | Tab hoặc section **Price history** - line chart (ApexCharts / lightweight SVG); toggle **Notify me on price drop** / **Notify when back in stock** |
| `account/WishlistPage` | Icon chuông trên item; bulk enable price alert |
| `account/PriceAlertsPage` (mới) | List alerts, unlink |
| Notifications inbox | Deep link → PDP |

UI English: *"Price dropped on …"*, *"Back in stock"*, *"Notify me when the price drops"*.

Theme: storefront `theme-for-aidr-fe` - chart trong card `product-additional-info` style.

---

## 7. Notification copy

| Event | Title | Body |
|-------|-------|------|
| Price drop | Price drop alert | `{ProductName}` is now {NewPrice} (was {OldPrice}). |
| Back in stock | Back in stock | `{ProductName}` is available again. |

`Type = Promo`, `ReferenceType = Product`, `ReferenceId = ProductId`.

Mở rộng `NotificationConstants`:

```csharp
public const string TypePriceAlert = "PriceAlert"; // hoặc reuse TypePromo v1
public const string RefPriceAlert = "PriceAlert";
```

Dedupe: cùng `(UserId, ProductId, AlertType)` + `CreatedAt` trong 24h → skip.

---

## 8. Seed & dev endpoint

- `scripts/seed-price-alerts.sql` - 2 SP có history giả 90 ngày; 1 buyer có alert; 1 SP out-of-stock → in-stock scenario.  
- `POST /api/dev/seed-price-alerts` (Development only).  
- Prerequisites: demo buyer, approved products, `ProductPriceHistories` rows.

---

## 9. Phases

| Phase | Nội dung |
|-------|----------|
| **A** | GET price-history + PDP chart (read-only) |
| **B** | CRUD alerts + wishlist/PDP toggles |
| **C** | Background job + notifications |
| **D** | Polish: wishlist page, account alerts list |

---

## 10. Không làm (v1)

- Email alert (chỉ in-app + SignalR).  
- Alert theo category / brand (chỉ per product).  
- Push browser notification / PWA.  
- So sánh giá với sàn khác.

---

## 11. Acceptance criteria

- [ ] Guest thấy chart 90 ngày trên PDP SP có ≥2 điểm history.  
- [ ] Buyer bật price drop alert; seller giảm giá ≥ ngưỡng → 1 notification trong 24h.  
- [ ] Buyer bật back-in-stock; seller nhập tồn → 1 notification.  
- [ ] Tắt alert → job không fire.  
- [ ] Seed tái hiện được scenario trên local.

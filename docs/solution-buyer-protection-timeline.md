# AIDR - Solution: Buyer Protection Timeline

**Status:** Implemented  
**Module:** Order + Settlement + Return (read-only buyer UI)  
**Use case:** UC-86 (View Buyer Protection Timeline)  
**Liên quan:** UC-35, UC-40, UC-42, UC-43, `solution-escrow-settlement.md`, `solution-auto-fulfillment-shipping.md`  
**Phạm vi:** Buyer thấy timeline minh bạch trên order detail: thanh toán, giao hàng, cửa sổ xác nhận/return, escrow seller (không lộ số tiền seller net chi tiết nếu không cần).

---

## 1. Yêu cầu

> Sau khi mua, buyer hiểu **đang ở bước nào**, **được bảo vệ đến khi nào**, **khi nào có thể return** - không cần đọc policy chung.

### 1.1 Các mốc hiển thị (buyer-facing)

| Step | Label (EN) | Nguồn data |
|------|------------|------------|
| 1 | Payment confirmed | `Orders.Status >= Paid`, `Payments` |
| 2 | Order confirmed | `Confirmed` + optional GHN `Shipments` |
| 3 | Shipped | `Shipping` + tracking code |
| 4 | Delivered | `Delivered` + `DeliveredAt` |
| 5 | Completed / Protection active | `Completed` hoặc auto-complete countdown |
| 6 | Return window | `CompletedAt + ReturnWindowDays` (BR return) |
| 7 | *(optional)* Escrow note | Buyer-friendly: *"Your payment is protected until you confirm receipt or the return window ends"* |

**Không hiển thị:** commission 3%, `SettlementEntries` status seller, payout batch - thuộc seller/admin.

### 1.2 Nguyên tắc

1. **Read-only aggregation** - không đổi logic settlement/return.  
2. **Status-driven** - mốc tương lai hiện estimated date từ config.  
3. **Return conflict** - nếu có `ReturnRequest` open → step riêng *Return in progress*.  
4. **English labels** - giải thích ngắn, không thuật ngữ kế toán.  
5. **Guest không xem** - chỉ buyer owner order.

---

## 2. Hiện trạng

| Đang có | Thiếu |
|---------|-------|
| `OrderDetailPage` buyer - status badge, tracking | Không timeline visual |
| Settlement backend + seller/admin pages | Buyer không thấy protection narrative |
| `Settlement:AutoCompleteDays`, `HoldDays` config | Không surface ra buyer |
| Return request flow UC-43 | Không gắn deadline return window trên timeline |
| GHN `Shipments` + events | Chưa merge vào buyer timeline |

---

## 3. DTO & API

### GET `/api/orders/{orderId}/protection-timeline`

Auth: Buyer owner.

```json
{
  "orderId": "guid",
  "orderStatus": "Delivered",
  "currency": "VND",
  "steps": [
    {
      "key": "payment",
      "label": "Payment confirmed",
      "state": "done",
      "at": "2026-09-01T10:00:00Z",
      "detail": "Paid via payOS."
    },
    {
      "key": "shipped",
      "label": "Shipped",
      "state": "done",
      "at": "2026-09-02T08:00:00Z",
      "detail": "Tracking: GHN123456."
    },
    {
      "key": "delivered",
      "label": "Delivered",
      "state": "current",
      "at": "2026-09-05T14:00:00Z",
      "detail": null
    },
    {
      "key": "confirm_or_auto",
      "label": "Confirm receipt",
      "state": "upcoming",
      "at": null,
      "detail": "Auto-confirms on Sep 12 if you do not confirm or request a return.",
      "dueAt": "2026-09-12T14:00:00Z"
    },
    {
      "key": "return_window",
      "label": "Return window",
      "state": "upcoming",
      "dueAt": "2026-09-19T14:00:00Z",
      "detail": "You can request a return with video evidence until this date after completion."
    },
    {
      "key": "protection",
      "label": "Buyer protection",
      "state": "info",
      "detail": "Funds are held until you confirm delivery or the return period ends."
    }
  ],
  "returnRequest": {
    "status": null,
    "canOpen": true,
    "returnDeadline": null
  },
  "shipmentTrackingUrl": "https://..."
}
```

`state`: `done` | `current` | `upcoming` | `info` | `warning` | `cancelled`.

Service: `BuyerProtectionTimelineService` trong module Order - inject order repo, shipment repo, return repo, `IOptions<SettlementOptions>`.

---

## 4. Logic tính mốc

```csharp
// Pseudocode
autoCompleteDue = DeliveredAt + SettlementOptions.AutoCompleteDays
returnWindowEnd = CompletedAt + ReturnConstants.WindowDays  // e.g. 7 from BR

if Status == Delivered && !Completed:
  current = delivered
  upcoming confirm_or_auto with dueAt = autoCompleteDue

if Status == Completed:
  return_window state = current if now <= returnWindowEnd else done
  canOpenReturn = now <= returnWindowEnd && no blocking return
```

Map GHN events (optional Phase B): sub-steps under Shipped (*Picked up*, *In transit*) - max 3 để không rối.

---

## 5. Frontend

`OrderDetailPage.tsx`:

- Card **Buyer protection** phía trên order lines - vertical stepper (storefront theme).  
- Icon trạng thái: done ✓, current pulse, upcoming gray.  
- Link *Track shipment* khi có tracking.  
- Nút **Request return** disable + tooltip khi ngoài window (reuse existing return hook).  
- Collapsible *What does this mean?* → FAQ ngắn English (payOS, no exchange, video evidence).

Không dùng admin theme trên account buyer.

---

## 6. Schema

**Không migration v1** - compute từ `Orders`, `Shipments`, `ReturnRequests`, config.

Optional cache Redis `order:protection:{orderId}` TTL 5 phút - invalidate on status webhook.

---

## 7. Config surface (buyer copy only)

| Config key | Buyer text driver |
|------------|-------------------|
| `Settlement:AutoCompleteDays` | Auto-confirm date |
| `Return:WindowDaysAfterCompleted` | Return deadline |
| `Shipping:Ghn:TrackingUrlTemplate` | External track link |

Thêm section `BuyerProtection` nếu cần toggle hiển thị escrow note:

```json
"BuyerProtection": {
  "ShowEscrowNote": true,
  "FaqUrl": "/faqs#returns"
}
```

---

## 8. Seed & test

- Dùng seed order có sẵn ở các status: Paid, Shipping, Delivered, Completed, Completed+Return open.  
- `POST /api/dev/seed-protection-timeline-demo` - tạo 1 order Delivered sắp auto-complete.  
- Không cần SQL riêng nếu seed orders đủ trạng thái.

---

## 9. Phases

| Phase | Deliverable |
|-------|-------------|
| **A** | API + service core steps (payment → completed) |
| **B** | FE stepper on order detail |
| **C** | GHN tracking link + return window integration |
| **D** | FAQ accordion + edge cases (cancelled, return rejected) |

---

## 10. Không làm (v1)

- Hiển thị số tiền escrow / commission.  
- Cho buyer can thiệp settlement.  
- Live map tracking.  
- Email timeline (in-app only).

---

## 11. Acceptance criteria

- [ ] Order Delivered → buyer thấy countdown auto-complete đúng config.  
- [ ] Order Completed → return deadline đúng; nút return theo `canOpen`.  
- [ ] Return Pending → timeline step warning *Return in progress*.  
- [ ] English copy; không UC codes.  
- [ ] Seller/admin settlement pages không bị ảnh hưởng.

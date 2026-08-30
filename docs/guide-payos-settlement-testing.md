# Hướng dẫn: cấu hình payOS và test flow escrow trên UI

**Liên quan:** `docs/solution-escrow-settlement.md`
**Phạm vi:** bật payOS (thu tiền + chi hộ), rồi test trọn vòng buyer trả tiền → sàn giữ → admin duyệt → seller nhận, trừ 3% phí sàn.

---

## Phần 1 — Cấu hình payOS

### 1.1 Hai tính năng khác nhau, đừng nhầm

| | Dùng để | Trạng thái hiện tại |
|---|---|---|
| **Payment Request (VietQR)** | Buyer trả tiền cho đơn | ✅ Đang chạy thật, credential hợp lệ |
| **Chi hộ (Payouts)** | Sàn chuyển tiền cho seller | ⚠️ Phải **đăng ký riêng** với payOS |

Chi hộ **không tự có** khi bạn tạo kênh thanh toán. Phải liên hệ payOS để bật, ký hợp đồng chi hộ, và **nạp tiền vào tài khoản chi hộ** — tiền buyer trả về tài khoản nhận thanh toán, không tự chảy sang tài khoản chi hộ.

**Trước khi có Chi hộ, vẫn test và vận hành được đầy đủ** bằng `PayoutMode = "Manual"` (xem 1.4).

### 1.2 Lấy credential

1. Đăng nhập https://my.payos.vn
2. **Kênh thanh toán** → chọn kênh → tab **Thông tin xác thực**
3. Copy `Client ID`, `API Key`, `Checksum Key`

Điền vào `aidr-be/AIDR.Api/appsettings.Development.json`:

```jsonc
"PayOS": {
  "ClientId": "…",
  "ApiKey": "…",
  "ChecksumKey": "…",
  "UseMock": false,
  "ReturnUrl": "http://localhost:5173/order-received",
  "CancelUrl": "http://localhost:5173/order-received?cancelled=1"
}
```

Kiểm tra nhanh credential còn sống (không tạo dữ liệu gì):

```bash
curl -H "x-client-id: <ClientId>" -H "x-api-key: <ApiKey>" https://api-merchant.payos.vn/v2/payment-requests/999999999
```

Trả `{"code":"101","desc":"Mã thanh toán không tồn tại"}` là **auth OK**. Trả `401` là sai key.

### 1.3 Webhook — bắt buộc nếu muốn đơn tự lên `Paid`

payOS chỉ gọi webhook tới **URL public**. `localhost` không được.

```bash
ngrok http 5080
```

Lấy URL `https://xxxx.ngrok-free.app`, rồi gọi (cần token Admin):

```bash
curl -X POST http://localhost:5080/api/payments/payos/confirm-webhook \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl":"https://xxxx.ngrok-free.app/api/payments/payos/webhook"}'
```

payOS sẽ probe endpoint trước khi chấp nhận. **Không có bước này thì buyer trả tiền thật nhưng đơn vẫn treo `PendingPayment`** — đây là lý do phổ biến nhất khiến "thanh toán rồi mà không thấy gì".

### 1.4 Cấu hình settlement

Trong cùng file `appsettings.Development.json`:

```jsonc
"Settlement": {
  "CommissionRate": 0.03,      // phí sàn 3%
  "HoldDays": 30,              // giữ tiền 30 ngày kể từ khi đơn Completed
  "AutoCompleteDays": 7,       // Delivered -> Completed nếu buyer không bấm xác nhận
  "MinPayoutAmount": 50000,    // dưới mức này dồn sang kỳ sau
  "PayoutMode": "PayOs",       // "PayOs" | "Manual"
  "JobIntervalMinutes": 60,
  "EnableBackgroundJob": true
}
```

**Chọn `PayoutMode`:**

- `"Manual"` — dùng khi **chưa có Chi hộ**. Admin duyệt xong tự chuyển khoản qua app ngân hàng rồi bấm **Mark paid**. Toàn bộ sổ sách vẫn đúng.
- `"PayOs"` — cần Chi hộ đã bật + tài khoản chi hộ có số dư. Kiểm tra số dư bất cứ lúc nào:

```bash
curl -H "Authorization: Bearer <admin-token>" http://localhost:5080/api/admin/settlements/payout-balance
```

### 1.5 Áp schema (chỉ chạy 1 lần)

```
scripts/settlement-schema.sql
scripts/seed-settlement-backfill.sql
```

Đã chạy trên DB local rồi. Chỉ cần chạy lại khi dựng DB mới.

---

## Phần 2 — Test trên UI

### 2.0 Rút ngắn thời gian chờ để test

Vòng thật là 30 ngày. Để test trong vài phút, chọn **một** trong hai cách:

**Cách A — đơn mới, giữ 0 ngày** (khuyến nghị, test đúng luồng code)

```jsonc
"Settlement": { "HoldDays": 0, "AutoCompleteDays": 0, "JobIntervalMinutes": 1 }
```

Restart API. Đơn nào `Completed` sẽ vào escrow rồi thành `Eligible` ngay ở lần sweep kế tiếp.

**Cách B — kéo ngày đáo hạn của 14 entry đang giữ về quá khứ**

```sql
UPDATE dbo.SettlementEntries
SET HoldUntil = DATEADD(DAY, -1, SYSUTCDATETIME())
WHERE Status = N'Holding';
```

Rồi vào `/admin/settlements` bấm **Run sweep now**.

> ⚠️ Nhớ trả `HoldDays` về `30` sau khi test xong.

### 2.1 Seller khai tài khoản ngân hàng

1. Đăng nhập **seller** → sidebar **Settlements** (`/seller/settlements`)
2. Đầu trang có banner vàng *"Payouts are on hold — Add a bank account…"* → đúng, chưa khai thì chưa chi được
3. Card **Payout bank account**, điền:

   | Trường | Giá trị test |
   |---|---|
   | Bank BIN | `970422` (MB Bank) — [danh sách BIN](https://api.vietqr.io/v2/banks) |
   | Bank name | `MB Bank` |
   | Account number | số tài khoản thật của bạn nếu định test chi tiền thật |
   | Account holder | **đúng tên chủ tài khoản, không dấu** |

4. **Save account** → toast *"Bank account saved…"*, badge chuyển **Unverified**

✅ **Kỳ vọng:** banner đổi thành *"waiting for admin verification"*. Tên sai là nguyên nhân fail chi hộ số 1 — payOS đối chiếu tên.

### 2.2 Admin duyệt tài khoản ngân hàng

1. Đăng nhập **admin** → **Settlements** (`/admin/settlements`)
2. Nếu shop đã có entry `Eligible`, shop hiện ở bảng **Ready to pay out** với badge **Unverified** và link **Verify**
3. Bấm **Verify**

✅ **Kỳ vọng:** badge thành **Verified**, cột Action đổi từ dòng lý do chặn sang nút **Approve & pay**.

> Nếu shop chưa có entry `Eligible` thì chưa xuất hiện ở bảng này — làm 2.0 trước.

### 2.3 Đặt một đơn mới đi trọn vòng

1. **Buyer**: chọn sản phẩm → **Buy Now** → Checkout → **Place order & pay**
2. Redirect sang payOS → quét VietQR bằng app ngân hàng (số tiền thật, nên test với sản phẩm rẻ)
3. Webhook về → đơn `PendingPayment` → **`Paid`**
4. **Seller** (`/seller/orders`): `Paid` → **Confirmed** → **Shipping** → **Delivered**
5. **Buyer** (`/account/orders/{id}`): bấm **Confirm received** → đơn **`Completed`**

✅ **Kỳ vọng ngay sau bước 5** — vào `/seller/settlements`:

| Cột | Giá trị |
|---|---|
| Order | mã đơn |
| Gross | đúng số buyer đã trả |
| Platform fee | `−3% × (Subtotal − Discount)` |
| You receive | Gross − fee |
| Status | **Holding** |
| Release | *In 30 days* (hoặc *Ready…* nếu `HoldDays=0`) |

Card **Holding** tăng đúng bằng "You receive". Card **Wallet → Pending settlement** cũng khớp.

> Bỏ qua bước 5 cũng được: sau `AutoCompleteDays` job tự đưa đơn `Delivered` → `Completed`. Đây là điểm trước đây đơn bị kẹt vĩnh viễn.

### 2.4 Hết thời gian giữ → Eligible

1. **Admin** → `/admin/settlements` → **Run sweep now**

✅ **Kỳ vọng:**
- Seller: entry đổi **Holding** → **Eligible**, cột Release ghi *"Ready — waiting for admin approval"*; card **Ready to pay out** tăng
- Admin: shop xuất hiện ở bảng **Ready to pay out** với Orders / Gross / Fee / Net payout
- Seller nhận notification

### 2.5 Admin duyệt và chi

1. Bấm **Approve & pay**
2. Confirm dialog hiện: số tiền, **tên chủ tài khoản**, số TK, số đơn, phí sàn → đọc kỹ rồi OK

✅ **Kỳ vọng theo `PayoutMode`:**

**`Manual`**
- Batch `PAY-...` trạng thái **Approved**
- Seller: entry → **Approved**, card **Approved, transferring** tăng, **Ready to pay out** về 0
- Ví seller: `Pending` giảm, `Available` tăng đúng bằng Net
- → Bạn chuyển khoản tay → quay lại bấm **Mark paid** (nhập mã giao dịch nếu muốn)

**`PayOs`**
- Hệ thống check số dư chi hộ trước. Không đủ → toast báo rõ *"payOS payout account holds X but this batch needs Y"* (không phải lỗi payOS thô)
- Đủ → gọi Chi hộ, batch **Processing** → **Paid** (hoặc job poll cập nhật sau)
- Fail → batch **Failed** kèm lý do, có nút **Retry**. **Tiền vẫn nằm trong ví seller**, không mất

✅ **Sau khi Paid:**
- Seller: entry → **Paid**, Release ghi *"Paid · PAY-…"*, card **Paid out** tăng, **Recent payouts** có dòng mới
- Ví seller: `Available` giảm về mức trước khi release
- Admin KPI: **Platform commission** = tổng 3%, **GMV settled** tăng, **Held in escrow** giảm

### 2.6 Kiểm tra sổ ví

`/seller/wallet` → filter theo loại giao dịch. Một đơn đi trọn vòng phải để lại **4 dòng**:

| Thứ tự | Loại | Số tiền | Available | Pending |
|---|---|---|---|---|
| 1 | Settlement held | `+Net` | 0 | `+Net` |
| 2 | Platform fee | `−Fee` | 0 | 0 (dòng thông tin) |
| 3 | Settlement released | `+Net` | `+Net` | `−Net` |
| 4 | Payout | `−Net` | `−Net` | 0 |

### 2.7 Test đổi trả (quan trọng — 2 nhánh khác nhau)

**Nhánh A — trả hàng khi tiền còn đang giữ**

1. Buyer `/account/orders/{id}` → **Request return**
2. ✅ Seller: entry đổi ngay sang **On hold**, Release ghi *"Paused until the dispute closes"*
3. ✅ Admin bấm **Run sweep now** → entry **không** lên `Eligible` (đúng: đơn đang tranh chấp không được chi)
4. Admin `/admin/return-requests` → Approve → Receiving → **Refunded**
5. ✅ Entry → **Reversed**, `Pending` giảm, **sàn không thu 3%** trên đơn này

**Nhánh B — trả hàng sau khi đã chi**
- `Available` bị trừ (được phép âm theo BR-R04) **và** phần phí 3% được hoàn lại vào ví — sàn không ăn phí trên đơn bị trả

**Từ chối return** → entry quay lại **Holding**/**Eligible** như cũ.

---

## Phần 3 — Chẩn đoán nhanh

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Trả tiền xong đơn vẫn `PendingPayment` | Webhook chưa đăng ký (1.3) hoặc ngrok đã đổi URL |
| Đơn `Completed` mà không thấy entry | API chưa restart sau khi deploy code mới |
| Bảng **Ready to pay out** trống dù escrow > 0 | Chưa hết `HoldDays`, hoặc entry đang `OnHold` vì có return mở |
| Shop hiện nhưng không có nút Approve | Đọc cột lý do: chưa có TK / chưa verify / dưới 50.000đ / đang có batch mở |
| `"payOS payout account holds …"` | Tài khoản chi hộ chưa đủ số dư — nạp thêm hoặc chuyển `PayoutMode=Manual` |
| Batch **Failed** | Xem `failureReason`. Sai tên/số TK là phổ biến nhất. Sửa TK → verify lại → **Retry** |
| Phí hiện `No fee` | Đơn cũ được backfill ở mức 0% (grandfather, cố ý) |

**Xem thẳng dưới DB:**

```sql
SELECT Status, COUNT(*) Cnt, SUM(NetAmount) Net, SUM(CommissionAmount) Fee
FROM dbo.SettlementEntries GROUP BY Status;

SELECT BatchCode, Status, NetAmount, ProviderState, FailureReason, AttemptCount
FROM dbo.PayoutBatches ORDER BY CreatedAt DESC;

SELECT ShopId, AvailableBalance, PendingBalance FROM dbo.Wallets;
```

**Bất biến phải luôn đúng:** `Wallets.PendingBalance` = `SUM(NetAmount)` của các entry `Holding` + `OnHold` + `Eligible` của shop đó.

```sql
SELECT w.ShopId, w.PendingBalance, ISNULL(SUM(s.NetAmount), 0) AS LedgerPending
FROM dbo.Wallets w
LEFT JOIN dbo.SettlementEntries s
  ON s.ShopId = w.ShopId AND s.Status IN (N'Holding', N'OnHold', N'Eligible')
GROUP BY w.ShopId, w.PendingBalance
HAVING w.PendingBalance <> ISNULL(SUM(s.NetAmount), 0);
```

Query này trả **0 dòng** là sổ sách khớp.

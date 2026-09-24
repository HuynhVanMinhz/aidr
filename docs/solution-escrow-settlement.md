# AIDR - Solution: Escrow, đối soát và chi trả cho seller (phí sàn 3%)

**Status:** Implemented - schema + backend + FE đã ship; xem §15 những gì đã chạy và còn lại
**Module:** Payment + SellerCenter + Admin
**Liên quan:** UC-35 (payOS), UC-52 (return/refund), `docs/architecture-aidr-be.md` §7.4
**Phạm vi:** tiền buyer trả → sàn giữ → sau ~1 tháng admin duyệt → trả seller sau khi trừ 3% phí sàn.

---

## 1. Yêu cầu và nguyên tắc

> Buyer trả tiền → tiền vào sàn. Sau ~1 tháng, admin duyệt → trả lại cho seller, sàn giữ **3%** làm phí duy trì/quảng cáo.

Nguyên tắc thiết kế:

1. **Ledger là nguồn sự thật, không phải số dư.** Mọi biến động tiền là một dòng append-only; số dư ví là kết quả cộng dồn. Không bao giờ UPDATE số tiền của một dòng đã ghi.
2. **Một đơn = một entry đối soát.** Truy vết được từng đồng: đơn nào, giữ đến bao giờ, phí bao nhiêu, nằm trong batch chi nào.
3. **Snapshot tỉ lệ phí.** `CommissionRate` lưu trên từng entry. Đổi phí 3% → 4% sau này không làm sai lệch các đơn cũ.
4. **Idempotent ở mọi bước.** Webhook lặp, admin bấm 2 lần, job chạy trùng - không được chi 2 lần.
5. **Chi tiền là bước tách rời khỏi duyệt.** payOS có thể fail; duyệt rồi mà chưa chi thì tiền vẫn nằm trong ví seller, retry được.
6. **Không tự động chi khi đơn còn tranh chấp.** Đơn có return request đang mở thì entry bị khoá, không vào batch.

### 1.1 Một điểm cần nói rõ về "tiền vào sàn"

payOS **không** giữ tiền hộ. Khi buyer thanh toán, payOS đối soát và chuyển về **tài khoản ngân hàng của sàn** (thường T+1). Vậy:

- **Escrow ở đây là escrow kế toán**, không phải escrow do payOS giữ. Tiền vật lý nằm ở bank của sàn; AIDR ghi sổ "đang nợ shop X số tiền Y, giải phóng ngày Z".
- Để **chi ra** cho seller, dùng payOS **Chi hộ (Payouts)** - chính là API đang dùng cho refund ở UC-52. Tính năng này cần bật riêng trên merchant account và cần **số dư tài khoản chi hộ**, nên phải có bước kiểm tra số dư trước mỗi đợt chi (§7.1).

Hệ quả: sàn phải chủ động nạp tiền từ tài khoản nhận thanh toán sang tài khoản chi hộ trước kỳ đối soát. Đây là thao tác vận hành, không phải code.

---

## 2. Hiện trạng và khoảng trống

| Đang có | Vấn đề với flow mới |
|---|---|
| `Wallets.AvailableBalance` + `PendingBalance` | `PendingBalance` **chưa bao giờ được ghi**; `SellerFinanceRepository` tính "pending" bằng cách SUM đơn theo status - không phải số dư thật |
| `OrderRepository.CreditSellerWalletAsync` | Cộng **nguyên `order.TotalAmount`** vào `AvailableBalance` ngay khi buyer confirm received → **không trừ phí, không giữ 1 tháng** |
| `WalletTransactions` (OrderCredit / RefundDebit / Withdrawal / Adjustment) | Chỉ ghi được biến động của `AvailableBalance`, không ghi được `PendingBalance` |
| `PayOsClient.RefundAsync` → `Payouts.CreateAsync` | Đã chạy được chi hộ 1 lệnh; chưa có batch, chưa có poll trạng thái, chưa check số dư |
| - | **Shop không có thông tin ngân hàng** ở bất kỳ bảng nào → không thể chi tiền |
| - | Không có background job nào trong hệ thống (`AddHostedService` = 0 chỗ) |
| - | Đơn `Delivered` mà buyer không bấm confirm thì **kẹt vĩnh viễn**, tiền không bao giờ vào pipeline |

---

## 3. Vòng đời tiền của một đơn

```
                    buyer trả (payOS webhook)
PendingPayment ─────────────────────────────► Paid
                                                │  tiền đã về sàn, CHƯA ghi sổ cho shop
                                                ▼
                             Confirmed → Shipping → Delivered
                                                │
                    buyer confirm │ hoặc job auto-complete sau 7 ngày
                                                ▼
                                            Completed
                                                │  ① tạo SettlementEntry(Holding)
                                                │     PendingBalance += Net
                                                ▼
                                   ⏳ giữ 30 ngày (HoldUntil)
                                                │
                        có return đang mở? ──yes──► OnHold (chờ xử lý)
                                                │ no
                                                ▼  ② job hạ cờ
                                            Eligible
                                                │
                                    admin gom batch + duyệt
                                                ▼  ③ Release
                                            Approved
                                                │     PendingBalance -= Net
                                                │     AvailableBalance += Net
                                                │     ghi nhận doanh thu phí sàn
                                                ▼
                                  payOS Payouts (chi hộ)
                                                ▼  ④ Payout
                                              Paid
                                                      AvailableBalance -= Net
```

Bốn mốc ghi sổ - mỗi mốc là một (hoặc vài) dòng `WalletTransactions`:

| # | Mốc | Available | Pending | Trigger |
|---|---|---|---|---|
| ① | Hold | 0 | `+Net` | order → `Completed` |
| ② | (Eligible) | 0 | 0 | job, chỉ đổi status entry |
| ③ | Release | `+Net` | `−Net` | admin approve batch |
| ④ | Payout | `−Net` | 0 | payOS payout thành công |

Tách ③ và ④ để: payOS fail → tiền vẫn nằm trong ví seller (`Available`), retry được, và seller nhìn thấy "đã duyệt, đang chuyển khoản".

---

## 4. Công thức tiền

```
Gross            = Orders.TotalAmount              -- đúng số buyer đã trả
isPlatformVoucher = Voucher.Scope == System
SubsidyAmount    = isPlatformVoucher ? Discount : 0
sellerDiscount   = isPlatformVoucher ? 0 : Discount
Commissionable   = Subtotal - sellerDiscount       -- loại ShippingFee
Commission       = ROUND(Commissionable * CommissionRate)
Net              = Gross - Commission + SubsidyAmount
```

Quyết định và lý do:

- **Không tính phí trên phí ship.** `Commissionable` loại `ShippingFee` ra. Hiện `DefaultShippingFee = 0` nên chưa khác gì, nhưng khi bật ship thật thì tính 3% trên tiền ship là sai.
- **Làm tròn về VND nguyên.** payOS nhận `amount` kiểu integer (`PaymentService.ToVndInteger` đã ép điều này).
- **Voucher System (Admin): sàn bù.** Buyer giảm giá nhờ voucher sàn → `SubsidyAmount = Discount`, seller vẫn nhận gần như đủ (chỉ trừ phí nền tảng). Phí tính trên full Subtotal.
- **Voucher Shop (Seller): shop chịu.** `SubsidyAmount = 0`, phí tính trên `Subtotal − Discount`.
- **Phí chuyển khoản payOS do sàn chịu**, trừ vào 3%. Nếu tính vào Net thì seller nhận số lẻ khó đối soát.

Ví dụ đơn 20.990.000đ, voucher **sàn** 50.000đ, ship 0:

| | |
|---|---|
| Subtotal | 20.990.000 |
| Discount | −50.000 |
| Gross (buyer trả) | **20.940.000** |
| SubsidyAmount | **50.000** |
| Commissionable | 20.990.000 |
| Commission 3% | **629.700** |
| Net (seller nhận) | **20.360.300** |

Cùng đơn với voucher **shop** 50.000đ: Subsidy = 0, Commissionable = 20.940.000, Commission = 628.200, Net = **20.311.800**.

---

## 5. Schema

### 5.1 `ShopBankAccounts` - bắt buộc, hiện chưa có

```sql
CREATE TABLE dbo.ShopBankAccounts (
    ShopBankAccountId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ShopBankAccounts PRIMARY KEY
                      CONSTRAINT DF_ShopBankAccounts_Id DEFAULT (NEWSEQUENTIALID()),
    ShopId            UNIQUEIDENTIFIER NOT NULL,
    BankBin           NVARCHAR(20)     NOT NULL,   -- payOS toBin, vd '970422' (MB)
    BankName          NVARCHAR(150)    NULL,
    AccountNumber     NVARCHAR(40)     NOT NULL,
    AccountName       NVARCHAR(150)    NOT NULL,   -- phải khớp tên chủ tài khoản
    Status            NVARCHAR(20)     NOT NULL CONSTRAINT DF_ShopBank_Status DEFAULT (N'Unverified'),
        -- Unverified | Verified | Rejected
    IsDefault         BIT              NOT NULL CONSTRAINT DF_ShopBank_IsDefault DEFAULT (1),
    VerifiedBy        UNIQUEIDENTIFIER NULL,
    VerifiedAt        DATETIME2(3)     NULL,
    RejectReason      NVARCHAR(300)    NULL,
    CreatedAt         DATETIME2(3)     NOT NULL CONSTRAINT DF_ShopBank_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt         DATETIME2(3)     NOT NULL CONSTRAINT DF_ShopBank_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ShopBank_Shop FOREIGN KEY (ShopId) REFERENCES dbo.Shops (ShopId),
    CONSTRAINT FK_ShopBank_VerifiedBy FOREIGN KEY (VerifiedBy) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_ShopBank_Status CHECK (Status IN (N'Unverified', N'Verified', N'Rejected'))
);
GO
CREATE UNIQUE INDEX UX_ShopBank_Default ON dbo.ShopBankAccounts (ShopId)
    WHERE IsDefault = 1;
GO
```

**Chỉ tài khoản `Verified` mới được chi.** Seller nhập → admin duyệt (đối chiếu với giấy tờ đăng ký bán hàng). Tài khoản sai tên là nguyên nhân fail payout phổ biến nhất.

### 5.2 `SettlementEntries` - sổ cái đối soát, 1 dòng / đơn

```sql
CREATE TABLE dbo.SettlementEntries (
    SettlementEntryId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SettlementEntries PRIMARY KEY
                      CONSTRAINT DF_SettlementEntries_Id DEFAULT (NEWSEQUENTIALID()),
    OrderId           UNIQUEIDENTIFIER NOT NULL,
    ShopId            UNIQUEIDENTIFIER NOT NULL,
    GrossAmount       DECIMAL(18,2)    NOT NULL,   -- Orders.TotalAmount
    SubsidyAmount     DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Settle_Subsidy DEFAULT (0),
    CommissionRate    DECIMAL(6,4)     NOT NULL,   -- snapshot, vd 0.0300
    CommissionAmount  DECIMAL(18,2)    NOT NULL,
    NetAmount         DECIMAL(18,2)    NOT NULL,
    Currency          CHAR(3)          NOT NULL CONSTRAINT DF_Settle_Currency DEFAULT ('VND'),
    Status            NVARCHAR(20)     NOT NULL CONSTRAINT DF_Settle_Status DEFAULT (N'Holding'),
        -- Holding | OnHold | Eligible | Approved | Paid | Reversed
    HoldUntil         DATETIME2(3)     NOT NULL,
    EligibleAt        DATETIME2(3)     NULL,
    PayoutBatchId     UNIQUEIDENTIFIER NULL,
    HoldReason        NVARCHAR(300)    NULL,       -- vì sao bị OnHold
    ReversedReason    NVARCHAR(300)    NULL,
    CreatedAt         DATETIME2(3)     NOT NULL CONSTRAINT DF_Settle_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt         DATETIME2(3)     NOT NULL CONSTRAINT DF_Settle_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Settle_Order UNIQUE (OrderId),          -- idempotency ở tầng DB
    CONSTRAINT FK_Settle_Order FOREIGN KEY (OrderId) REFERENCES dbo.Orders (OrderId),
    CONSTRAINT FK_Settle_Shop  FOREIGN KEY (ShopId)  REFERENCES dbo.Shops (ShopId),
    CONSTRAINT CK_Settle_Status CHECK (Status IN
        (N'Holding', N'OnHold', N'Eligible', N'Approved', N'Paid', N'Reversed')),
    CONSTRAINT CK_Settle_Amounts CHECK (
        CommissionAmount >= 0 AND NetAmount >= 0 AND GrossAmount >= 0)
);
GO
CREATE INDEX IX_Settle_Shop_Status_HoldUntil
    ON dbo.SettlementEntries (ShopId, Status, HoldUntil);
CREATE INDEX IX_Settle_Batch ON dbo.SettlementEntries (PayoutBatchId);
GO
```

`UQ_Settle_Order` là chốt chặn idempotency mạnh nhất: dù webhook lặp hay job chạy trùng, một đơn không thể sinh 2 entry.

### 5.3 `PayoutBatches` - một lần admin duyệt = một batch / shop

```sql
CREATE TABLE dbo.PayoutBatches (
    PayoutBatchId    UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_PayoutBatches PRIMARY KEY
                     CONSTRAINT DF_PayoutBatches_Id DEFAULT (NEWSEQUENTIALID()),
    BatchCode        NVARCHAR(30)     NOT NULL,   -- PAY-20260930-AB12CD34
    ShopId           UNIQUEIDENTIFIER NOT NULL,
    ShopBankAccountId UNIQUEIDENTIFIER NOT NULL,  -- snapshot tài khoản lúc duyệt
    PeriodTo         DATETIME2(3)     NOT NULL,   -- cut-off: entry Eligible <= mốc này
    EntryCount       INT              NOT NULL,
    GrossAmount      DECIMAL(18,2)    NOT NULL,
    CommissionAmount DECIMAL(18,2)    NOT NULL,
    NetAmount        DECIMAL(18,2)    NOT NULL,   -- số thực chi
    Currency         CHAR(3)          NOT NULL CONSTRAINT DF_Payout_Currency DEFAULT ('VND'),
    Status           NVARCHAR(20)     NOT NULL CONSTRAINT DF_Payout_Status DEFAULT (N'Draft'),
        -- Draft | Approved | Processing | Paid | Failed | Cancelled
    ApprovedBy       UNIQUEIDENTIFIER NULL,
    ApprovedAt       DATETIME2(3)     NULL,
    ProviderPayoutId NVARCHAR(100)    NULL,       -- payOS payout id
    ProviderState    NVARCHAR(40)     NULL,
    PaidAt           DATETIME2(3)     NULL,
    FailureReason    NVARCHAR(500)    NULL,
    AttemptCount     INT              NOT NULL CONSTRAINT DF_Payout_Attempts DEFAULT (0),
    RawResponseJson  NVARCHAR(MAX)    NULL,
    CreatedAt        DATETIME2(3)     NOT NULL CONSTRAINT DF_Payout_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt        DATETIME2(3)     NOT NULL CONSTRAINT DF_Payout_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Payout_Code UNIQUE (BatchCode),
    CONSTRAINT FK_Payout_Shop FOREIGN KEY (ShopId) REFERENCES dbo.Shops (ShopId),
    CONSTRAINT FK_Payout_Bank FOREIGN KEY (ShopBankAccountId)
        REFERENCES dbo.ShopBankAccounts (ShopBankAccountId),
    CONSTRAINT FK_Payout_ApprovedBy FOREIGN KEY (ApprovedBy) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Payout_Status CHECK (Status IN
        (N'Draft', N'Approved', N'Processing', N'Paid', N'Failed', N'Cancelled'))
);
GO
-- Mỗi shop chỉ có 1 batch đang mở tại một thời điểm
CREATE UNIQUE INDEX UX_Payout_OpenPerShop ON dbo.PayoutBatches (ShopId)
    WHERE Status IN (N'Draft', N'Approved', N'Processing');
GO
```

`BatchCode` dùng luôn làm **`referenceId` + `idempotencyKey`** khi gọi payOS - bấm chi 2 lần cũng chỉ ra 1 lệnh.

### 5.4 Mở rộng `WalletTransactions`

`WalletTransactions.BalanceAfter` hiện chỉ phản ánh `AvailableBalance`. Thêm 1 cột để ghi được cả hai vế:

```sql
ALTER TABLE dbo.WalletTransactions
    ADD PendingAfter DECIMAL(18,2) NULL;   -- NULL cho các dòng lịch sử
GO
```

Bộ `TxType` mở rộng (cột đã là `NVARCHAR(30)`, không cần đổi):

| TxType | Amount | Available | Pending | Ghi ở bước |
|---|---|---|---|---|
| `SettlementHold` | `+Net` | 0 | `+Net` | ① |
| `CommissionFee` | `−Commission` | 0 | 0 | ① (dòng thông tin, phục vụ báo cáo) |
| `SettlementRelease` | `+Net` | `+Net` | `−Net` | ③ |
| `Payout` | `−Net` | `−Net` | 0 | ④ |
| `SettlementReversal` | `−Net` | 0 | `−Net` | return khi entry còn `Holding`/`OnHold` |
| `OrderCredit` | - | - | - | **deprecated**, giữ để đọc dữ liệu cũ |
| `RefundDebit` | `−refund` | `−refund` | 0 | đã có, dùng khi entry đã `Approved`/`Paid` |
| `Adjustment` | `±` | `±` | `±` | admin chỉnh tay |

Nhớ cập nhật `SellerFinanceConstants.WalletTxTypes` (đang validate whitelist ở `SellerFinanceService`).

### 5.5 Cấu hình

```jsonc
"Settlement": {
  "CommissionRate": 0.03,      // 3% phí sàn
  "HoldDays": 30,              // giữ tiền sau khi đơn Completed
  "AutoCompleteDays": 7,       // Delivered -> Completed nếu buyer không bấm
  "MinPayoutAmount": 50000,    // dưới mức này dồn sang kỳ sau
  "PayoutMode": "PayOs",       // PayOs | Manual
  "JobIntervalMinutes": 60
}
```

`CommissionRate` **không** đọc lại khi tính tiền cho entry cũ - mỗi entry đã snapshot rate của chính nó.

`PayoutMode: Manual` là đường lui: admin duyệt xong tự chuyển khoản ngoài rồi bấm "đánh dấu đã chi". Cần thiết vì Chi hộ payOS phải xin bật riêng, không chắc có ngay.

---

## 6. Điểm chạm vào code hiện có

### 6.1 Sửa `OrderRepository.CreditSellerWalletAsync`

Đây là thay đổi quan trọng nhất. Hàm hiện tại cộng thẳng `TotalAmount` vào `AvailableBalance` - phải thay bằng "tạo entry + cộng Pending":

```csharp
// Cũ: wallet.AvailableBalance += order.TotalAmount
// Mới:
private async Task HoldSettlementAsync(Order order, DateTime now, CancellationToken ct)
{
    // UQ_Settle_Order đã chặn trùng ở DB, check ở đây để không ném exception vô ích
    if (await _db.SettlementEntries.AnyAsync(e => e.OrderId == order.OrderId, ct))
        return;

    var wallet = await _db.Wallets.FirstOrDefaultAsync(w => w.ShopId == order.ShopId, ct)
        ?? throw new AppException("Seller wallet was not found for this shop.");

    var rate          = _options.CommissionRate;
    var commissionable = order.SubtotalAmount - order.DiscountAmount;
    var commission     = decimal.Round(commissionable * rate, 0, MidpointRounding.AwayFromZero);
    var net            = order.TotalAmount - commission;

    _db.SettlementEntries.Add(new SettlementEntry
    {
        OrderId = order.OrderId,
        ShopId = order.ShopId,
        GrossAmount = order.TotalAmount,
        CommissionRate = rate,
        CommissionAmount = commission,
        NetAmount = net,
        Currency = order.Currency,
        Status = SettlementConstants.StatusHolding,
        HoldUntil = now.AddDays(_options.HoldDays),
        CreatedAt = now,
        UpdatedAt = now
    });

    wallet.PendingBalance += net;
    wallet.UpdatedAt = now;

    AddWalletTx(wallet, SettlementConstants.TxSettlementHold,  net,         order.OrderId, now);
    AddWalletTx(wallet, SettlementConstants.TxCommissionFee,  -commission,  order.OrderId, now);
}
```

Gọi đúng chỗ cũ: `ConfirmReceivedAsync` (`OrderRepository.cs:330`), trong cùng transaction đang có.

### 6.2 `SellerFinanceRepository` - bỏ "pending giả"

`pendingSettlement` đang SUM `Orders.TotalAmount` theo status. Thay bằng số thật:

```csharp
// Cũ: SUM(o.TotalAmount) WHERE o.Status IN PendingSettlementStatuses
// Mới: wallet.PendingBalance
```

Và thêm bóc tách cho seller nhìn rõ: `Holding` (đang giữ) / `Eligible` (đủ điều kiện, chờ duyệt) / `Approved` (đã duyệt, đang chuyển) - query theo `SettlementEntries.Status`.

### 6.3 `AdminReturnRepository` - hai nhánh hoàn tiền

Khi admin duyệt return (`Refunded`), tuỳ trạng thái entry:

| Entry status | Xử lý |
|---|---|
| `Holding` / `OnHold` / `Eligible` | Entry → `Reversed`; `PendingBalance −= Net`; ghi `SettlementReversal`. **Không thu phí sàn** (commission không được ghi nhận). Tiền hoàn buyer lấy từ quỹ sàn - đúng như code hiện tại. |
| `Approved` / `Paid` | Giữ nguyên `RefundDebit` hiện có (trừ `AvailableBalance`, cho phép âm theo BR-R04). Thêm dòng `Adjustment` hoàn lại phần commission đã thu để không ăn phí trên đơn bị trả. |

Đồng thời, khi buyer **tạo** return request (order → `ReturnRequested`): entry `Holding`/`Eligible` → `OnHold` kèm `HoldReason`. Khi return bị `Rejected` → trả về `Holding`/`Eligible`.

### 6.4 `PayOsClient` - thêm 3 hàm

`RefundAsync` đã chứng minh `Payouts.CreateAsync` chạy được. Cần thêm:

```csharp
Task<PayOsPayoutBalance> GetPayoutBalanceAsync(CancellationToken ct);        // PayoutsAccount.GetBalanceAsync
Task<PayOsPayoutResult>  CreatePayoutAsync(PayOsPayoutCommand cmd, CT ct);   // Payouts.CreateAsync + idempotencyKey
Task<PayOsPayoutResult>  GetPayoutAsync(string payoutId, CT ct);             // Payouts.GetAsync - poll trạng thái
```

SDK `payOS 2.1.0` có sẵn `Payouts.Batch.CreateAsync` (chi nhiều lệnh 1 lần). **v1 không dùng batch API** - mỗi `PayoutBatch` của AIDR = 1 lệnh chi cho 1 shop, vì như vậy map 1-1 với `ProviderPayoutId` và retry đơn giản hơn nhiều. Batch API để dành khi số shop lớn.

`CreatePayoutAsync` dùng `idempotencyKey = BatchCode` - giống cách `RefundAsync` đang dùng `ReferenceId`.

### 6.5 Background job - hệ thống chưa có cái nào

`SettlementBackgroundService : BackgroundService`, chạy mỗi `JobIntervalMinutes`, mỗi vòng làm 3 việc độc lập (lỗi việc này không chặn việc kia):

1. **Auto-complete** - `Delivered` + `DeliveredAt < now − AutoCompleteDays` → `Completed` (đi qua đúng path `ConfirmReceivedAsync` để không bỏ sót việc tạo entry). Không có bước này thì đơn buyer quên confirm sẽ kẹt mãi.
2. **Hạ cờ eligible** - `Holding` + `HoldUntil <= now` + đơn không có return đang mở → `Eligible`, `EligibleAt = now`. Notify seller + admin.
3. **Poll payout** - batch `Processing` → `GetPayoutAsync`, cập nhật `Paid` / `Failed`.

Cần lock để 2 instance không chạy trùng (`sp_getapplock` hoặc một bảng lock đơn giản). Với deploy 1 instance thì chưa gấp, nhưng phải ghi vào doc để không quên.

---

## 7. Chi tiền - chi tiết bước dễ sai nhất

### 7.1 Preflight trước khi execute batch

Chặn theo thứ tự, fail sớm:

1. Batch ở trạng thái `Approved`.
2. `ShopBankAccounts.Status = Verified`.
3. `NetAmount >= MinPayoutAmount`.
4. `GetPayoutBalanceAsync()` ≥ `NetAmount` + dự phòng phí. **Thiếu số dư chi hộ là lỗi vận hành phổ biến nhất** - báo admin rõ ràng, đừng để lỗi payOS thô nổi lên UI.
5. `PayoutMode = PayOs` (nếu `Manual` thì bỏ qua, chờ admin đánh dấu tay).

### 7.2 Thực thi

```
Batch: Approved → Processing   (ghi trước khi gọi payOS)
  ↓
Payouts.CreateAsync(referenceId: BatchCode, idempotencyKey: BatchCode,
                    amount: NetAmount, toBin, toAccountNumber,
                    description: "AIDR " + BatchCode)   -- ≤ 25 ký tự, xem TruncatePayoutDescription
  ↓
lưu ProviderPayoutId + ProviderState + RawResponseJson
  ↓
state COMPLETED/SUCCEEDED → Paid  : AvailableBalance −= Net, entries → Paid, ghi Payout tx
state PROCESSING/PENDING   → giữ Processing, job poll tiếp
state FAILED               → Failed + FailureReason, AttemptCount++, tiền vẫn nằm ở Available
```

**Đổi status sang `Processing` *trước* khi gọi payOS.** Nếu app chết giữa chừng, khi khởi động lại ta biết có lệnh "có thể đã gửi" và phải poll chứ không được gửi lại mù.

`description` payOS giới hạn 25 ký tự - đã có `TruncatePayoutDescription` trong `PayOsClient`, tái sử dụng.

### 7.3 Retry

Retry = gọi lại `CreatePayoutAsync` với **cùng `idempotencyKey`**. payOS trả lại lệnh cũ nếu đã nhận, không tạo lệnh mới. Chỉ cho retry khi `Status = Failed`, và giới hạn `AttemptCount <= 3` rồi buộc admin can thiệp tay.

---

## 8. API

### Seller

| Method | Route | Mô tả |
|---|---|---|
| `GET` | `/api/seller/finance/settlements` | List entry: order code, gross, commission, net, status, `holdUntil`, đếm ngược |
| `GET` | `/api/seller/finance/settlements/summary` | Tổng theo status: holding / onHold / eligible / approved / paidThisMonth |
| `GET` | `/api/seller/bank-account` | Tài khoản nhận tiền hiện tại + trạng thái duyệt |
| `PUT` | `/api/seller/bank-account` | Khai/đổi tài khoản → reset về `Unverified` |
| `GET` | `/api/seller/finance/payouts` | Lịch sử batch đã chi |

### Admin

| Method | Route | Mô tả |
|---|---|---|
| `GET` | `/api/admin/settlements/eligible` | Gom theo shop: số entry, tổng net, cảnh báo (chưa có bank / chưa verify / dưới min) |
| `POST` | `/api/admin/settlements/batches` | Tạo batch `Draft` cho 1 shop với cut-off `periodTo` |
| `POST` | `/api/admin/settlements/batches/{id}/approve` | **Duyệt** → release (bước ③), khoá entry vào batch |
| `POST` | `/api/admin/settlements/batches/{id}/execute` | Gọi payOS (bước ④). Có thể tự chạy ngay sau approve |
| `POST` | `/api/admin/settlements/batches/{id}/retry` | Chi lại batch `Failed` |
| `POST` | `/api/admin/settlements/batches/{id}/mark-paid` | Chốt tay khi `PayoutMode=Manual` |
| `POST` | `/api/admin/settlements/entries/{id}/hold` | Khoá 1 entry (nghi ngờ gian lận) |
| `POST` | `/api/admin/shops/{shopId}/bank-account/verify` | Duyệt / từ chối tài khoản ngân hàng |
| `GET` | `/api/admin/finance/commission?from=&to=` | Báo cáo doanh thu phí sàn 3% |

Tất cả route ghi tiền: policy `Admin`, và **ghi audit** (ai duyệt, lúc nào, số tiền bao nhiêu).

---

## 9. Báo cáo phí sàn

Doanh thu sàn = tổng `CommissionAmount` của entry **đã được release** (`Approved` hoặc `Paid`) - không tính entry còn `Holding` vì đơn còn có thể bị trả.

```sql
CREATE OR ALTER VIEW dbo.vw_PlatformCommission
AS
SELECT
    s.ShopId,
    sh.ShopName,
    CAST(b.ApprovedAt AS DATE) AS RecognizedDate,
    COUNT(*)                   AS OrderCount,
    SUM(s.GrossAmount)         AS Gmv,
    SUM(s.CommissionAmount)    AS Commission,
    SUM(s.NetAmount)           AS PaidToSeller
FROM dbo.SettlementEntries s
INNER JOIN dbo.PayoutBatches b ON b.PayoutBatchId = s.PayoutBatchId
INNER JOIN dbo.Shops sh        ON sh.ShopId = s.ShopId
WHERE s.Status IN (N'Approved', N'Paid')
GROUP BY s.ShopId, sh.ShopName, CAST(b.ApprovedAt AS DATE);
GO
```

Admin dashboard thêm 4 KPI card (dùng luôn `AdminStatCard`): **GMV**, **Phí sàn 3%**, **Đã chi cho seller**, **Đang giữ (escrow)**.

---

## 10. Frontend

**Seller - `/seller/wallet`:** đổi từ 1 con số thành 3 khối

```
Đang giữ        Chờ duyệt       Đã duyệt, đang chuyển
12.400.000 ₫    3.100.000 ₫     20.311.800 ₫
(8 đơn)         (2 đơn)         (batch PAY-20260930-AB12CD34)
```

Bảng đối soát từng đơn: mã đơn · tổng tiền · phí 3% · thực nhận · **giải phóng sau N ngày**. Cột "giải phóng sau" là thứ seller quan tâm nhất, đừng chôn nó.

Banner cảnh báo (không phải toast - đây là trạng thái thường trực, theo đúng ranh giới đã thống nhất ở lượt trước): *"Chưa có tài khoản ngân hàng đã xác minh - tiền vẫn được giữ nhưng chưa thể chi."*

**Admin - `/admin/settlements`:** danh sách shop đủ điều kiện chi, tick chọn, xem preview `Gross / Phí / Thực chi`, nút **Duyệt & chi**. Confirm dialog phải hiện đúng số tiền và tên chủ tài khoản - đây là thao tác không hoàn tác được.

---

## 11. Di trú dữ liệu hiện có

Các đơn `Completed` cũ đã được cộng **nguyên `TotalAmount`** vào `AvailableBalance` (không trừ phí). Xử lý:

1. Backfill `SettlementEntries` cho mọi đơn `Completed`, với `CommissionRate = 0`, `Commission = 0`, `Net = Gross`, `Status = Paid`, `PayoutBatchId = NULL`.
2. **Grandfather - không truy thu.** Đơn cũ giữ nguyên phí 0%. Truy thu 3% ngược lại sẽ làm số dư seller âm và sai lệch dữ liệu demo.
3. Từ ngày bật tính năng, đơn mới dùng rate trong config.
4. Script `scripts/seed-settlement-backfill.sql`, idempotent (theo `UQ_Settle_Order`), có phần verify ở cuối như `seed-inventory-lots.sql`.

---

## 12. Lộ trình

| Phase | Nội dung | Chặn bởi |
|---|---|---|
| **0** | Schema + config + `ShopBankAccounts` CRUD + admin verify | - |
| **1** | Sửa `CreditSellerWalletAsync` → tạo entry + Pending. Sửa `SellerFinanceRepository`. Backfill | 0 |
| **2** | `SettlementBackgroundService`: auto-complete + hạ cờ eligible | 1 |
| **3** | Admin batch: tạo / duyệt / release. `PayoutMode=Manual` chạy được end-to-end | 2 |
| **4** | payOS Payouts: preflight balance, execute, poll, retry | 3 + bật Chi hộ trên merchant |
| **5** | Reversal khi return + báo cáo phí sàn + UI seller/admin | 4 |

**Phase 3 đã dùng được thật** với chuyển khoản tay. Phase 4 chỉ là tự động hoá bước cuối - nên không bị chặn bởi việc payOS có duyệt Chi hộ hay không.

---

## 13. Rủi ro và cách chặn

| Rủi ro | Chặn |
|---|---|
| Chi 2 lần cho cùng một batch | `idempotencyKey = BatchCode` + `UX_Payout_OpenPerShop` + đổi `Processing` trước khi gọi |
| Một đơn vào 2 batch | `SettlementEntries.PayoutBatchId` gán trong cùng transaction với approve |
| payOS Chi hộ chưa được bật | `PayoutMode = Manual` - vận hành được ngay từ phase 3 |
| Không đủ số dư tài khoản chi hộ | Preflight `GetPayoutBalanceAsync` + cảnh báo admin, không để lỗi payOS thô lên UI |
| Sai tên/số tài khoản seller | Bắt buộc `Verified` mới được chi; admin đối chiếu hồ sơ đăng ký bán hàng |
| Buyer trả hàng sau khi đã chi tiền | `RefundDebit` cho phép `AvailableBalance` âm (BR-R04); bù trừ vào kỳ sau |
| Đơn `Delivered` kẹt vì buyer không confirm | Job auto-complete sau 7 ngày |
| Race giữa job và thao tác admin | Cả hai đi qua cùng service, transaction + kiểm tra status trước khi ghi |
| Job chạy trùng khi scale nhiều instance | App lock; hiện deploy 1 instance nên chưa gấp, nhưng đừng quên |
| Đổi tỉ lệ phí làm sai đơn cũ | `CommissionRate` snapshot trên từng entry |

---

## 14. Câu hỏi cần chốt trước khi code

1. **Mốc đếm 30 ngày** - từ `CompletedAt` (buyer nhận hàng, đề xuất) hay từ `PaidAt`? Nếu từ `PaidAt` thì đơn ship chậm sẽ được giải phóng gần như ngay khi nhận hàng, mất tác dụng bảo vệ buyer.
2. **Voucher của sàn** - sàn có bù phần giảm giá cho shop không? **Có** — `SubsidyAmount = Discount` khi Scope=System; Shop voucher thì shop chịu.
3. **Chu kỳ chi** - admin duyệt theo từng shop lúc nào cũng được, hay cố định (vd ngày 1 và 15 hằng tháng)? Ảnh hưởng tới việc có cần cron thật hay chỉ cần nút bấm.
4. **Phí chuyển khoản payOS** - sàn chịu (đề xuất) hay trừ vào tiền seller?
5. **Ngưỡng chi tối thiểu** - 50.000đ có hợp lý không, hay để 0 và chi hết?


---

## 15. Trạng thái triển khai

Các quyết định ở §14 đã chốt như sau:

| # | Câu hỏi | Chốt |
|---|---|---|
| 1 | Mốc 30 ngày | Từ **`CompletedAt`** - phủ trọn cửa sổ đổi trả |
| 2 | Voucher sàn | **Sàn bù** (`SubsidyAmount`); Shop voucher → shop chịu |
| 3 | Chu kỳ chi | Admin bấm bất kỳ lúc nào; job chỉ hạ cờ `Eligible`, không cron cứng |
| 4 | Phí chuyển khoản payOS | **Sàn chịu**, trừ vào 3% |
| 5 | Ngưỡng chi tối thiểu | **50.000đ**, dưới mức dồn sang kỳ sau |

### Đã làm

**Database** - `scripts/settlement-schema.sql` (đã chạy trên DB local): `ShopBankAccounts`,
`SettlementEntries`, `PayoutBatches`, `WalletTransactions.PendingAfter`, view
`vw_PlatformCommission`. `scripts/seed-settlement-backfill.sql` đã backfill 16 đơn
`Completed` cũ ở mức phí 0% (grandfather) và đồng bộ lại `PendingBalance`.

**Backend**
- `OrderRepository.CreditSellerWalletAsync` → `HoldSettlementAsync`: tạo entry + cộng
  `PendingBalance`, ghi `SettlementHold` và `CommissionFee`.
- `OrderRepository.AutoCompleteDeliveredOrderAsync` - đóng lỗ hổng đơn `Delivered` kẹt vĩnh viễn.
- `SettlementRepository` / `SettlementService` - toàn bộ vòng đời entry và batch.
- `PayOsClient` - `GetPayoutBalanceAsync`, `CreatePayoutAsync` (idempotencyKey = `BatchCode`), `GetPayoutAsync`.
- `SettlementBackgroundService` - sweep mỗi 60 phút (auto-complete → hạ cờ eligible → poll payout).
- `ReturnRepository` / `AdminReturnRepository` - khoá entry khi có return, mở lại khi bị từ chối,
  và `ReverseSettlementAsync` xử lý 2 nhánh hoàn tiền (trước/sau khi release).
- `SellerFinanceRepository` - `PendingBalance` giờ là số thật thay vì SUM đơn theo status.

**Frontend** - `/seller/settlements` (tài khoản ngân hàng + 4 KPI + bảng đối soát từng đơn +
lịch sử chi) và `/admin/settlements` (KPI phí sàn + danh sách shop đủ điều kiện + quản lý batch).

### Đã kiểm chứng

`dotnet build` sạch, `tsc --noEmit` sạch. Các chốt chặn idempotency kiểm tra trực tiếp trên DB:
`UQ_Settle_Order` chặn entry trùng, `CK_Settle_Status` chặn status lạ, `UX_Payout_OpenPerShop`
chặn 2 batch mở cùng lúc trên 1 shop (và cho phép batch mới sau khi batch cũ `Paid`).

### Còn lại

- Chưa chạy end-to-end qua UI (cần restart API và một đơn đi trọn vòng).
- payOS **Chi hộ** phải được bật trên merchant account + nạp số dư tài khoản chi hộ.
  Trước khi có, đặt `Settlement:PayoutMode = "Manual"` để vận hành bằng chuyển khoản tay.
- Nếu scale API >1 instance, `SettlementBackgroundService` cần app lock.

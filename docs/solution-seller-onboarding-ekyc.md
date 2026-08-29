# AIDR — Solution: Seller onboarding có eKYC (FPT.AI)

**Status:** Implemented
**Module:** Profile (buyer) + Admin · **Use case:** UC-05 (Become a seller)
**Phạm vi:** siết chặt luồng đăng ký bán hàng và bắt buộc xác thực danh tính bằng **FPT.AI eKYC** trước khi hồ sơ được gửi cho admin duyệt.

---

## 1. Khoảng trống của luồng hiện tại

Luồng cũ chỉ có 1 bước: buyer gõ tên shop + mô tả + dán vài URL rồi bấm gửi.

| Vấn đề | Hệ quả |
|---|---|
| **Không xác thực danh tính** | Ai cũng đăng ký được bằng tên bất kỳ. Bán hàng giả rồi biến mất, sàn không biết truy ai |
| `DocumentUrls` là mảng chuỗi tự do | Không biết URL đó là CCCD, giấy phép, hay ảnh mèo. Admin duyệt bằng niềm tin |
| Không thu thông tin pháp lý | `Shops.TaxCode` có sẵn trong schema nhưng **không bao giờ được điền** |
| Không phân loại hình thức kinh doanh | Cá nhân và công ty yêu cầu giấy tờ khác nhau, nhưng hệ thống đối xử như nhau |
| Status chỉ `Pending / Approved / Rejected` | Thiếu giấy tờ → buộc phải Reject, buyer nộp lại từ đầu |
| Một người mở được nhiều shop | Chỉ chặn bằng `OwnsShopAsync` trên userId; đổi email là mở tài khoản mới |

---

## 2. Luồng mới

```
┌ Bước 1 — Danh tính (eKYC) ────────────────────────────────────┐
│ Upload mặt trước + mặt sau CCCD  → FPT.AI IDR (OCR)           │
│ Upload ảnh chân dung             → FPT.AI Face Match          │
│                                                                │
│  OCR đọc được + face match ≥ ngưỡng  →  Passed                │
│  face match dưới ngưỡng nhưng > sàn  →  ManualReview           │
│  OCR không đọc được / lệch mặt       →  Failed (được thử lại)  │
└────────────────────────────────────────────────────────────────┘
                          ↓ bắt buộc Passed hoặc ManualReview
┌ Bước 2 — Hồ sơ kinh doanh ────────────────────────────────────┐
│ Tên shop · Hình thức (Cá nhân | Hộ KD | Công ty)              │
│ Mã số thuế (bắt buộc với Hộ KD và Công ty)                    │
│ Địa chỉ kinh doanh · SĐT · Email liên hệ · Mô tả              │
└────────────────────────────────────────────────────────────────┘
                          ↓
┌ Bước 3 — Giấy tờ pháp lý ─────────────────────────────────────┐
│ Cá nhân : không cần thêm (eKYC là đủ)                         │
│ Hộ / Cty: bắt buộc ảnh giấy phép kinh doanh                   │
└────────────────────────────────────────────────────────────────┘
                          ↓
┌ Bước 4 — Xem lại & gửi ───────────────────────────────────────┐
│ Hiện lại tên trên CCCD (đã xác thực) — không sửa được         │
└────────────────────────────────────────────────────────────────┘
                          ↓  Status = Pending
┌ Admin duyệt ──────────────────────────────────────────────────┐
│ Xem cạnh nhau: kết quả eKYC (ảnh, tên, số CCCD che, % khớp)   │
│ + hồ sơ kinh doanh + giấy tờ                                  │
│ → Approved (tạo Shop + Wallet) | Rejected | NeedsMoreInfo     │
└────────────────────────────────────────────────────────────────┘
```

`NeedsMoreInfo` là trạng thái mới: buyer **sửa và gửi lại chính hồ sơ đó**, không phải làm lại từ đầu — và eKYC đã pass thì không phải chụp CCCD lần nữa.

---

## 3. FPT.AI eKYC

| Việc | Endpoint | Ghi chú |
|---|---|---|
| Đọc CCCD/CMND | `POST https://api.fpt.ai/vision/idr/vnm` | header `api-key`; multipart field `image`; trả `id, name, dob, sex, home, address, doe, type` |
| So khớp khuôn mặt | `POST https://api.fpt.ai/dmp/checkface/v1` | header `api_key`; multipart `file[]` = ảnh CCCD + ảnh chân dung; trả `isMatch`, `similarity` |

⚠️ Hai endpoint dùng **tên header khác nhau**: OCR là `api-key` (gạch ngang), face match là `api_key` (gạch dưới). Gửi nhầm sẽ nhận 401.

Mặt sau CCCD chứa `issue_date` / `issue_loc` — mặt trước không có. `ReadIdCardAsync` OCR mặt sau riêng và ghép vào; nếu mặt sau lỗi thì bỏ qua, không làm hỏng cả lần xác thực.

`similarity` FPT.AI trả theo **phần trăm (0–100)**; client luôn chia 100 trước khi so với ngưỡng.

### 3.1 Ảnh đi đường nào

FE đã có sẵn luồng upload Cloudinary (dùng cho avatar, ảnh sản phẩm) nên **tái sử dụng**: FE upload ảnh lên Cloudinary rồi gửi **URL** cho BE; BE tải ảnh về và forward bytes sang FPT.AI.

Lý do không cho FE gọi thẳng FPT.AI: api-key sẽ lộ trong bundle.

> ⚠️ **Chặn SSRF:** BE chỉ tải ảnh từ host trong `FptAi:AllowedImageHosts` (mặc định `res.cloudinary.com`). Không có ràng buộc này thì endpoint trở thành proxy để quét mạng nội bộ.

### 3.2 Ngưỡng quyết định

```
similarity >= FaceMatchThreshold (0.80)      → Passed
similarity >= ManualReviewThreshold (0.60)   → ManualReview  (admin nhìn ảnh tự quyết)
similarity <  ManualReviewThreshold          → Failed
OCR không ra dữ liệu / thiếu số CCCD         → Failed
```

Vùng xám `ManualReview` là cố ý: ảnh mờ, đeo kính, ảnh CCCD cũ đều làm tụt similarity mà người thật vẫn đúng. Chặn cứng ở 0.80 sẽ loại oan seller thật.

### 3.3 Chống lạm dụng

- Tối đa `MaxAttemptsPerDay` (5) lần eKYC / user / ngày — mỗi lần gọi FPT.AI đều tốn tiền.
- Chỉ giữ **4 số cuối** CCCD ở dạng đọc được; số đầy đủ lưu dưới dạng **SHA-256 hash** để phát hiện trùng.
- Một danh tính = một seller: unique index trên `DocumentNumberHash` với `Status = 'Passed'`.

---

## 4. Schema

### 4.1 `KycVerifications` (mới)

```sql
KycVerificationId  UNIQUEIDENTIFIER PK
UserId             UNIQUEIDENTIFIER FK Users
Provider           NVARCHAR(30)      -- 'FPTAI'
DocumentType       NVARCHAR(30)      -- CCCD | CMND | Passport
DocumentNumberMask NVARCHAR(32)      -- '**** **** 1234'
DocumentNumberHash CHAR(64)          -- SHA-256, chống 1 người mở nhiều shop
FullName           NVARCHAR(150)
DateOfBirth        NVARCHAR(20)
Gender             NVARCHAR(20)
HomeTown           NVARCHAR(300)
PermanentAddress   NVARCHAR(500)
IssueDate / ExpiryDate NVARCHAR(20)
FrontImageUrl / BackImageUrl / SelfieImageUrl NVARCHAR(512)
FaceMatchSimilarity DECIMAL(5,4)
FaceMatched        BIT
Status             NVARCHAR(20)      -- Pending | Passed | ManualReview | Failed
FailureReason      NVARCHAR(500)
RawOcrJson / RawFaceJson NVARCHAR(MAX)
CreatedAt / VerifiedAt DATETIME2(3)
```

### 4.2 Mở rộng `SellerRegistrationRequests`

```sql
KycVerificationId  UNIQUEIDENTIFIER NULL FK   -- bắt buộc khi submit
BusinessType       NVARCHAR(20)  -- Individual | Household | Company
TaxCode            NVARCHAR(32)
BusinessAddress    NVARCHAR(300)
ContactPhone       NVARCHAR(20)
ContactEmail       NVARCHAR(256)
LicenseImageUrl    NVARCHAR(512)
-- CK_SellerReg_Status thêm 'NeedsMoreInfo'
```

---

## 5. API

### Buyer

| Method | Route | Mô tả |
|---|---|---|
| `GET` | `/api/kyc/me` | Kết quả eKYC mới nhất của tôi |
| `POST` | `/api/kyc/verify` | Body `{frontImageUrl, backImageUrl, selfieImageUrl}` → chạy OCR + face match, trả kết quả |
| `GET` | `/api/seller-registrations/me` | Hồ sơ đăng ký hiện tại (đã có) |
| `POST` | `/api/seller-registrations` | Gửi hồ sơ — **từ chối nếu chưa có eKYC Passed/ManualReview** |
| `PUT` | `/api/seller-registrations/me` | Sửa và gửi lại khi bị `NeedsMoreInfo` |

### Admin

| Method | Route | Mô tả |
|---|---|---|
| `GET` | `/api/admin/seller-registrations/{id}` | Trả kèm block `kyc` để đối chiếu |
| `POST` | `.../{id}/request-info` | Chuyển sang `NeedsMoreInfo` kèm ghi chú |

---

## 6. Quy tắc nghiệp vụ

1. **Không có eKYC → không gửi được hồ sơ.** Chặn ở service, không chỉ ở UI.
2. **Tên shop không được trùng** với shop đang hoạt động.
3. **Mã số thuế bắt buộc** với `Household` và `Company`; định dạng 10 hoặc 13 chữ số (`0123456789-001`).
4. **Giấy phép kinh doanh bắt buộc** với `Household` và `Company`.
5. **Một CCCD = một shop.** Hash trùng với hồ sơ đã `Approved` → từ chối.
6. **Tên trên hồ sơ lấy từ CCCD**, buyer không tự gõ — tránh khai khác giấy tờ.
7. eKYC `ManualReview` vẫn gửi được hồ sơ, nhưng admin thấy cảnh báo vàng.

---

## 7. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| FPT.AI chết / hết quota / chưa kích hoạt dịch vụ | Rơi về `ManualReview` — admin đọc giấy tờ bằng mắt. Không "pass ngầm", không mock |
| Mock bị bật nhầm ở production | `Program.cs` từ chối khởi động nếu `FptAi:UseMock=true` ngoài môi trường Development |
| Endpoint bị dùng để quét mạng nội bộ | Whitelist host ảnh (`AllowedImageHosts`) |
| Ảnh CCCD rò rỉ | Chỉ lưu URL Cloudinary; không lưu ảnh trong DB; số CCCD chỉ để mask + hash |
| Người thật bị loại oan | Vùng `ManualReview` để admin quyết bằng mắt |
| Đốt quota API | Giới hạn số lần thử/ngày |
| Ảnh chụp lại màn hình (spoof) | v1 chưa có liveness. FPT.AI có `/dmp/liveness/v3` — xem §8 |

---

## 7b. Khi FPT.AI không dùng được

Nếu client ném `ProviderUnavailableException` (chưa có key, key sai, hoặc 403 vì tài khoản chưa
kích hoạt dịch vụ), `KycService` **không** chặn seller và cũng **không** cho pass:

- lưu bản ghi `Status = ManualReview`, `Provider = MANUAL`, kèm 3 ảnh đã upload;
- các trường OCR để trống — vì không máy nào đọc chúng, không bịa dữ liệu;
- seller đi tiếp bước 2 (hồ sơ kinh doanh) như bình thường;
- màn hình admin hiện cảnh báo đỏ *"No automated check ran"* và yêu cầu người duyệt tự đối chiếu
  ảnh chân dung với ảnh trên CCCD trước khi duyệt.

Đây vẫn là xác thực thật — chỉ là do người làm thay vì máy.

---

## 8. Chưa làm (v2)

- **Liveness detection** (`POST https://api.fpt.ai/dmp/liveness/v3`) — chống chụp lại ảnh/màn hình. Cần buyer quay video ngắn, đổi UX bước 1.
- Đối chiếu mã số thuế với API Tổng cục Thuế.
- OCR giấy phép kinh doanh (hiện admin đọc bằng mắt).
- Ký hợp đồng điện tử với seller.

---

## 9. Cấu hình

```jsonc
"FptAi": {
  "BaseUrl": "https://api.fpt.ai",
  "ApiKey": "",                    // đặt qua user-secrets / biến môi trường, không commit
  "UseMock": false,                // mặc định gọi API thật
  "FaceMatchThreshold": 0.80,
  "ManualReviewThreshold": 0.60,
  "MaxAttemptsPerDay": 5,
  "TimeoutSeconds": 30,
  "AllowedImageHosts": [ "res.cloudinary.com" ]
}
```

Đặt key (không commit vào repo):

```bash
dotnet user-secrets set "FptAi:ApiKey" "<key>" --project aidr-be/AIDR.Api
```

Key lấy ở <https://console.fpt.ai> và phải **kích hoạt riêng** hai dịch vụ *ID Recognition* và *Face Match*; chỉ có key thôi thì API trả `403 {"message":"You cannot consume this service"}`.

`UseMock=true` chỉ dùng ở Development khi chưa có key: trả kết quả `Passed` giả lập với dữ liệu cố định để chạy hết luồng UI. Bản ghi khi đó được lưu với `Provider = "MOCK"`, DTO trả `isMock = true`, và màn hình KYC hiện cảnh báo rõ đây không phải kết quả thật. Ngoài Development, bật cờ này sẽ làm ứng dụng **không khởi động được**.

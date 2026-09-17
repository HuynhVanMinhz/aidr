# AIDR — Giải thích các trường trong Database

Tài liệu mô tả **từng bảng** và **ý nghĩa từng cột** trong schema SQL Server của AIDR (`database.sql`).  
Mỗi bảng có ví dụ minh họa để dễ tra cứu khi dev / test / viết seed.

> **Lưu ý quan trọng về giá:**
> - **Giá bán** (`BasePrice`, `SalePrice`) — khách thấy trên web, đổi bất cứ lúc nào.
> - **Giá nhập** (`InventoryLots.UnitCost`) — gắn với **từng lô**, lô cũ không bị ghi đè khi nhập lô mới.

---

## Mục lục

1. [Identity & Access](#1-identity--access)
2. [Seller / Shop](#2-seller--shop)
3. [Catalog (Danh mục & Sản phẩm)](#3-catalog-dan-mục--sản-phẩm)
4. [Kho & Giá vốn](#4-kho--giá-vốn)
5. [Giỏ hàng & Wishlist](#5-giỏ-hàng--wishlist)
6. [Voucher](#6-voucher)
7. [Đơn hàng & Thanh toán](#7-đơn-hàng--thanh-toán)
8. [Trả hàng (Returns)](#8-trả-hàng-returns)
9. [Đánh giá sản phẩm](#9-đánh-giá-sản-phẩm)
10. [Thông báo & Chat](#10-thông-báo--chat)
11. [Ví Seller (Wallet)](#11-ví-seller-wallet)
12. [AI & Hành vi người dùng](#12-ai--hành-vi-người-dùng)

---

## 1. Identity & Access

### `Roles` — Vai trò hệ thống

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `RoleId` | INT (PK) | ID tự tăng | `1` |
| `RoleCode` | NVARCHAR(32) | Mã vai trò (unique) | `BUYER`, `SELLER`, `ADMIN` |
| `RoleName` | NVARCHAR(64) | Tên hiển thị | `Buyer`, `Seller`, `Admin` |
| `Description` | NVARCHAR(256) | Mô tả ngắn | `Khách hàng mua sản phẩm` |
| `CreatedAt` | DATETIME2 | Thời điểm tạo (UTC) | `2026-03-15T10:00:00` |

**Ví dụ bản ghi:**
```text
RoleId=1, RoleCode=BUYER, RoleName=Buyer
RoleId=2, RoleCode=SELLER, RoleName=Seller
RoleId=3, RoleCode=ADMIN, RoleName=Admin
```

---

### `Users` — Người dùng

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `UserId` | UNIQUEIDENTIFIER (PK) | ID người dùng | `CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC` |
| `KeycloakSub` | NVARCHAR(64) | Subject ID từ Keycloak (OAuth) | `f:google:abc123...` |
| `Email` | NVARCHAR(256) | Email đăng nhập (unique) | `buyer@aidr.local` |
| `EmailConfirmed` | BIT | Email đã xác nhận | `1` (true) |
| `PasswordHash` | NVARCHAR(512) | Hash mật khẩu (nếu login email) | `$2a$...` hoặc `NULL` nếu chỉ OAuth |
| `FullName` | NVARCHAR(128) | Họ tên | `Tran Thi Buyer` |
| `Phone` | NVARCHAR(20) | Số điện thoại | `0900000003` |
| `AvatarUrl` | NVARCHAR(512) | URL avatar (Cloudinary) | `https://res.cloudinary.com/...` |
| `Gender` | NVARCHAR(16) | Giới tính | `Female`, `Male`, `NULL` |
| `DateOfBirth` | DATE | Ngày sinh | `1995-08-20` |
| `Status` | NVARCHAR(20) | Trạng thái tài khoản | `Active`, `Locked`, `PendingDeletion` |
| `FailedLoginCount` | INT | Số lần đăng nhập sai liên tiếp | `0` |
| `LockoutUntil` | DATETIME2 | Khóa đến thời điểm | `NULL` hoặc `2026-03-16T12:00:00` |
| `LastLoginAt` | DATETIME2 | Lần đăng nhập gần nhất | `2026-03-15T08:30:00` |
| `CreatedAt` / `UpdatedAt` | DATETIME2 | Audit | UTC |

---

### `UserRoles` — Gán vai trò cho user

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `UserId` | UNIQUEIDENTIFIER (PK, FK) | User | Seller demo |
| `RoleId` | INT (PK, FK) | Role | `2` (SELLER) |
| `AssignedAt` | DATETIME2 | Thời điểm gán | UTC |

**Ví dụ:** Một seller vừa bán vừa mua → có cả `SELLER` và `BUYER`.

---

### `Addresses` — Địa chỉ giao hàng

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `AddressId` | UNIQUEIDENTIFIER (PK) | ID địa chỉ | GUID |
| `UserId` | UNIQUEIDENTIFIER (FK) | Chủ sở hữu | Buyer |
| `ReceiverName` | NVARCHAR(128) | Tên người nhận | `Tran Thi Buyer` |
| `Phone` | NVARCHAR(20) | SĐT nhận hàng | `0900000003` |
| `Province` | NVARCHAR(100) | Tỉnh/TP | `Ha Noi` |
| `District` | NVARCHAR(100) | Quận/huyện | `Dong Da` |
| `Ward` | NVARCHAR(100) | Phường/xã | `Cat Linh` |
| `StreetAddress` | NVARCHAR(256) | Số nhà, đường | `25 Cat Linh` |
| `IsDefault` | BIT | Địa chỉ mặc định | `1` |
| `CreatedAt` / `UpdatedAt` | DATETIME2 | Audit | UTC |

**Ví dụ địa chỉ đầy đủ:** `25 Cat Linh, Cat Linh, Dong Da, Ha Noi`

---

### `PasswordResetTokens` — Token quên mật khẩu

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `TokenId` | UNIQUEIDENTIFIER (PK) | ID token | GUID |
| `UserId` | UNIQUEIDENTIFIER (FK) | User cần reset | GUID |
| `TokenHash` | NVARCHAR(128) | Hash token (không lưu plain) | `sha256:...` |
| `ExpiresAt` | DATETIME2 | Hết hạn | +1 giờ từ lúc tạo |
| `UsedAt` | DATETIME2 | Đã dùng lúc nào | `NULL` nếu chưa dùng |
| `CreatedAt` | DATETIME2 | Lúc tạo | UTC |

---

## 2. Seller / Shop

### `Shops` — Cửa hàng seller

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `ShopId` | UNIQUEIDENTIFIER (PK) | ID shop | `DDDDDDDD-...` |
| `OwnerUserId` | UNIQUEIDENTIFIER (FK, unique) | Chủ shop (1 user = 1 shop) | Seller user |
| `ShopName` | NVARCHAR(150) | Tên shop | `TechZone Official` |
| `Slug` | NVARCHAR(160) | URL slug (unique) | `techzone-official` → `/shops/techzone-official` |
| `Tagline` | NVARCHAR(200) | Slogan ngắn | `Điện thoại & Laptop chính hãng` |
| `ShortDescription` | NVARCHAR(500) | Mô tả ngắn | `Chuyên phân phối smartphone...` |
| `Description` | NVARCHAR(MAX) | Mô tả dài (HTML) | Chi tiết shop |
| `LogoUrl` / `BannerUrl` | NVARCHAR(512) | Ảnh logo/banner | Cloudinary URL |
| `Email` / `Phone` / `Hotline` | NVARCHAR | Liên hệ shop | `shop@techzone.vn` |
| `Province`, `District`, `Ward`, `StreetAddress` | NVARCHAR | Địa chỉ shop | `12 Xuan Thuy, Dich Vong, Cau Giay, Ha Noi` |
| `TaxCode` | NVARCHAR(32) | Mã số thuế | `0101234567` |
| `BusinessLicenseNo` | NVARCHAR(64) | Số GPKD | `GP-2024-001` |
| `CostingMethod` | NVARCHAR(20) | Cách tính giá vốn khi bán | `FIFO` hoặc `WeightedAverage` |
| `ReturnPolicy` | NVARCHAR(2000) | Chính sách đổi trả | `Đổi trả trong 7 ngày...` |
| `ShippingPolicy` | NVARCHAR(2000) | Chính sách giao hàng | `Giao 1-3 ngày nội thành...` |
| `OpeningHoursJson` | NVARCHAR(1000) | Giờ mở cửa (JSON) | `{"mon":"9-18","tue":"9-18"}` |
| `WebsiteUrl`, `FacebookUrl` | NVARCHAR(512) | Link ngoài | URL |
| `IsVerified` | BIT | Shop đã xác minh | `1` |
| `VerifiedAt` | DATETIME2 | Thời điểm verify | UTC |
| `Status` | NVARCHAR(20) | Trạng thái shop | `Active`, `Suspended`, `Closed` |
| `AvgRating` | DECIMAL(3,2) | Điểm TB đánh giá shop | `4.85` |
| `RatingCount` | INT | Số lượt đánh giá | `128` |
| `FollowerCount` | INT | Số người follow | `450` |
| `ProductCount` | INT | Số SP (denormalized) | `42` |
| `CreatedAt` / `UpdatedAt` | DATETIME2 | Audit | UTC |

---

### `SellerRegistrationRequests` — Đăng ký làm seller

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `RequestId` | UNIQUEIDENTIFIER (PK) | ID hồ sơ | GUID |
| `UserId` | UNIQUEIDENTIFIER (FK) | Người đăng ký | Buyer muốn lên seller |
| `ShopName` | NVARCHAR(150) | Tên shop dự kiến | `Green Mart Home` |
| `BusinessInfo` | NVARCHAR(1000) | Mô tả kinh doanh | `Household goods...` |
| `DocumentUrls` | NVARCHAR(MAX) | JSON mảng URL giấy tờ | `["https://.../license.jpg"]` |
| `Status` | NVARCHAR(20) | Trạng thái duyệt | `Pending`, `Approved`, `Rejected` |
| `AdminNote` | NVARCHAR(500) | Ghi chú admin (khi reject) | `Documents incomplete...` |
| `ReviewedBy` | UNIQUEIDENTIFIER (FK) | Admin duyệt | Admin user |
| `ReviewedAt` | DATETIME2 | Lúc duyệt | UTC |
| `CreatedAt` | DATETIME2 | Lúc nộp | UTC |

---

### `SellerFollows` — Buyer follow shop

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `BuyerUserId` | UNIQUEIDENTIFIER (PK, FK) | Buyer | GUID |
| `ShopId` | UNIQUEIDENTIFIER (PK, FK) | Shop được follow | GUID |
| `FollowedAt` | DATETIME2 | Thời điểm follow | UTC |

---

### `SellerRatings` — Đánh giá shop (theo đơn)

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `SellerRatingId` | UNIQUEIDENTIFIER (PK) | ID đánh giá | GUID |
| `ShopId` | UNIQUEIDENTIFIER (FK) | Shop | TechZone |
| `BuyerUserId` | UNIQUEIDENTIFIER (FK) | Buyer đánh giá | GUID |
| `OrderId` | UNIQUEIDENTIFIER (FK, nullable) | Đơn liên quan | Mỗi đơn tối đa 1 rating/shop |
| `Score` | TINYINT | Điểm 1–5 | `5` |
| `Comment` | NVARCHAR(1000) | Nhận xét | `Giao nhanh, đóng gói cẩn thận` |
| `CreatedAt` / `UpdatedAt` | DATETIME2 | Audit | UTC |

---

## 3. Catalog (Danh mục & Sản phẩm)

### `Categories` — Danh mục (cây phân cấp)

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `CategoryId` | INT (PK) | ID danh mục | `1` |
| `ParentId` | INT (FK, nullable) | Danh mục cha | `NULL` = root |
| `Name` | NVARCHAR(120) | Tên | `Điện thoại` |
| `Slug` | NVARCHAR(140) | URL slug (unique) | `dien-thoai` |
| `Description` | NVARCHAR(500) | Mô tả | `Smartphone các hãng` |
| `ImageUrl` | NVARCHAR(512) | Ảnh danh mục | Cloudinary |
| `SortOrder` | INT | Thứ tự hiển thị | `1` |
| `IsActive` | BIT | Đang bật | `1` |
| `CreatedAt` / `UpdatedAt` | DATETIME2 | Audit | UTC |

---

### `Products` — Sản phẩm

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `ProductId` | UNIQUEIDENTIFIER (PK) | ID sản phẩm | GUID |
| `ShopId` | UNIQUEIDENTIFIER (FK) | Shop bán | TechZone |
| `CategoryId` | INT (FK) | Danh mục | `1` (Điện thoại) |
| `Name` | NVARCHAR(256) | Tên SP | `Samsung Galaxy S24 256GB` |
| `Slug` | NVARCHAR(280) | Slug trong shop (unique/shop) | `samsung-galaxy-s24-256gb` |
| `ShortDescription` | NVARCHAR(500) | Mô tả ngắn | `Flagship Samsung, màn 6.2"...` |
| `Description` | NVARCHAR(MAX) | Mô tả dài | HTML chi tiết |
| `Brand` | NVARCHAR(100) | Thương hiệu | `Samsung` |
| `ModelNumber` | NVARCHAR(100) | Mã model | `SM-S921B` |
| `Sku` | NVARCHAR(64) | SKU shop | `TZ-S24-256` |
| `Barcode` | NVARCHAR(64) | Mã vạch | EAN |
| `ConditionType` | NVARCHAR(20) | Tình trạng | `New`, `LikeNew`, `Refurbished`, `Used` |
| **`BasePrice`** | DECIMAL(18,2) | **Giá bán niêm yết** | `12500000` (VND) |
| **`SalePrice`** | DECIMAL(18,2) | **Giá khuyến mãi** (nullable) | `11900000` hoặc `NULL` |
| `Currency` | CHAR(3) | Tiền tệ | `VND` |
| **`LastCostPrice`** | DECIMAL(18,2) | Giá vốn lô nhập gần nhất | `12000000` |
| **`AvgCostPrice`** | DECIMAL(18,2) | Giá vốn TB gia quyền | `10666666.67` |
| `StockQuantity` | INT | Tổng tồn (= sum lô còn) | `15` |
| `ReservedQuantity` | INT | Đang giữ cho đơn chưa trả tiền | `2` |
| `LowStockThreshold` | INT | Ngưỡng cảnh báo tồn thấp | `5` |
| `WarrantyMonths` | INT | Bảo hành (tháng) | `12` |
| `WeightGrams`, `LengthCm`, `WidthCm`, `HeightCm` | | Kích thước/khối lượng | Ship fee |
| `OriginCountry` | NVARCHAR(80) | Xuất xứ | `Viet Nam` |
| `TagsJson` | NVARCHAR(MAX) | Tags JSON | `["flagship","samsung","5g"]` |
| `SpecsJson` | NVARCHAR(MAX) | Thông số (filter/AI) | `{"ram":"8GB","storage":"256GB"}` |
| `VariantOptionsJson` | NVARCHAR(MAX) | Trục variant | `[{"name":"Color","values":["Orange","White"]}]` |
| `MetaTitle` / `MetaDescription` | NVARCHAR | SEO | |
| `IsFeatured` | BIT | SP nổi bật | `0` |
| `PublishedAt` | DATETIME2 | Lúc lên kệ (sau approve) | UTC |
| **`Status`** | NVARCHAR(20) | Trạng thái duyệt | `Draft`, `Pending`, `Approved`, `Rejected`, `Inactive`, `Deleted` |
| `AvgRating` | DECIMAL(3,2) | Điểm TB review | `4.7` |
| `ReviewCount` | INT | Số review | `23` |
| `SoldCount` | INT | Đã bán (denormalized) | `150` |
| `ViewCount` | INT | Lượt xem | `3200` |
| `CreatedAt` / `UpdatedAt` | DATETIME2 | Audit | UTC |

**Ví dụ giá bán vs giá vốn:**
- Bán: `BasePrice = 12.500.000`
- Lô A nhập 10 máy @ 10tr, Lô B 5 máy @ 12tr → `AvgCostPrice ≈ 10.666.667`

---

### `ProductImages` — Ảnh sản phẩm

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `ProductImageId` | UNIQUEIDENTIFIER (PK) | ID ảnh | GUID |
| `ProductId` | UNIQUEIDENTIFIER (FK) | SP | GUID |
| `ImageUrl` | NVARCHAR(512) | URL Cloudinary | `https://res.cloudinary.com/.../s24.jpg` |
| `PublicId` | NVARCHAR(256) | Public ID Cloudinary | `s24` |
| `SortOrder` | INT | Thứ tự gallery | `0` = ảnh đầu |
| `IsPrimary` | BIT | Ảnh đại diện | `1` |
| `CreatedAt` | DATETIME2 | Audit | UTC |

---

### `ProductVariants` — Biến thể (màu, dung lượng…)

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `VariantId` | UNIQUEIDENTIFIER (PK) | ID variant | GUID |
| `ProductId` | UNIQUEIDENTIFIER (FK) | SP gốc | GUID |
| `Sku` | NVARCHAR(64) | SKU variant | `TZ-S24-256-OR` |
| `VariantName` | NVARCHAR(150) | Tên hiển thị | `128GB / Orange` |
| `AttributesJson` | NVARCHAR(MAX) | Thuộc tính | `{"Color":"Orange","Storage":"128GB"}` |
| `Price` | DECIMAL(18,2) | Giá bán variant | `12500000` |
| `SalePrice` | DECIMAL(18,2) | KM riêng variant | `NULL` |
| `LastCostPrice` / `AvgCostPrice` | DECIMAL | Giá vốn variant | |
| `StockQuantity` / `ReservedQuantity` | INT | Tồn variant | |
| `ImageUrl` | NVARCHAR(512) | Ảnh theo variant | |
| `SortOrder` | INT | Thứ tự | `0` |
| `IsActive` | BIT | Còn bán | `1` |
| `CreatedAt` / `UpdatedAt` | DATETIME2 | Audit | UTC |

---

## 4. Kho & Giá vốn

### `InventoryLots` — Lô nhập kho

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `LotId` | UNIQUEIDENTIFIER (PK) | ID lô | GUID |
| `ProductId` | UNIQUEIDENTIFIER (FK) | SP | Galaxy S24 |
| `VariantId` | UNIQUEIDENTIFIER (FK, nullable) | Variant (nếu có) | `NULL` hoặc GUID |
| `LotCode` | NVARCHAR(40) | Mã lô (unique/product) | `LOT-20260110-001` |
| `QuantityReceived` | INT | SL nhập ban đầu | `10` |
| `QuantityRemaining` | INT | SL còn trong lô | `7` |
| **`UnitCost`** | DECIMAL(18,2) | **Giá nhập/đơn vị lô này** | `10000000` |
| `Currency` | CHAR(3) | Tiền tệ | `VND` |
| `SupplierName` | NVARCHAR(150) | Nhà cung cấp | `NCC Samsung VN` |
| `InvoiceNumber` | NVARCHAR(80) | Số hóa đơn nhập | `INV-A-001` |
| `ReceivedAt` | DATETIME2 | Ngày nhập | `2026-01-10` |
| `ExpiresAt` | DATETIME2 | Hạn dùng (optional) | `NULL` |
| `Status` | NVARCHAR(20) | Trạng thái lô | `Open`, `Depleted`, `Void` |
| `Note` | NVARCHAR(500) | Ghi chú | `Lô nhập đầu — giá vốn 10tr/máy` |
| `CreatedBy` | UNIQUEIDENTIFIER (FK) | Seller nhập | GUID |
| `CreatedAt` | DATETIME2 | Audit | UTC |

**Ví dụ 2 lô cùng SP:**
| LotCode | UnitCost | Qty nhập | Qty còn |
|---------|----------|----------|---------|
| LOT-20260110-001 | 10.000.000 | 10 | 10 |
| LOT-20260301-002 | 12.000.000 | 5 | 5 |

---

### `ProductPriceHistories` — Lịch sử đổi **giá bán**

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `PriceHistoryId` | BIGINT (PK) | ID | `1` |
| `ProductId` | UNIQUEIDENTIFIER (FK) | SP | GUID |
| `VariantId` | UNIQUEIDENTIFIER (FK, nullable) | Variant | `NULL` |
| `OldBasePrice` / `NewBasePrice` | DECIMAL | Giá niêm yết cũ/mới | `11000000` → `12500000` |
| `OldSalePrice` / `NewSalePrice` | DECIMAL | Giá KM cũ/mới | |
| `ChangedBy` | UNIQUEIDENTIFIER (FK) | Seller đổi giá | GUID |
| `Reason` | NVARCHAR(300) | Lý do | `Điều chỉnh theo giá vốn lô mới` |
| `ChangedAt` | DATETIME2 | Thời điểm | UTC |

---

### `InventoryTransactions` — Biến động kho

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `InventoryTxId` | BIGINT (PK) | ID giao dịch | `1001` |
| `ProductId` | UNIQUEIDENTIFIER (FK) | SP | GUID |
| `VariantId` | UNIQUEIDENTIFIER (FK) | Variant | `NULL` |
| `LotId` | UNIQUEIDENTIFIER (FK) | Lô liên quan | GUID |
| **`ChangeQty`** | INT | Thay đổi SL (+ nhập / − xuất) | `+10`, `-2` |
| `UnitCost` | DECIMAL(18,2) | Giá vốn tại thời điểm GD | `10000000` |
| **`Reason`** | NVARCHAR(40) | Loại movement | Xem bảng dưới |
| `ReferenceType` | NVARCHAR(40) | Loại tham chiếu | `Lot`, `Order`, `ReturnRequest` |
| `ReferenceId` | UNIQUEIDENTIFIER | ID tham chiếu | OrderId, LotId… |
| `Note` | NVARCHAR(300) | Ghi chú | `Nhập lô A` |
| `CreatedBy` | UNIQUEIDENTIFIER (FK) | Người thực hiện | Seller |
| `CreatedAt` | DATETIME2 | Thời điểm | UTC |

**Giá trị `Reason` thường gặp:**

| Reason | Ý nghĩa |
|--------|---------|
| `StockIn` | Nhập lô mới |
| `ManualAdjust` | Seller điều chỉnh tay |
| `OrderReserve` | Giữ tồn khi tạo đơn |
| `OrderRelease` | Trả tồn khi hủy đơn |
| `OrderSold` | Trừ tồn khi bán (fulfill) |
| `ReturnRestock` | Nhập lại kho từ trả hàng |
| `VoidLot` | Hủy lô |

---

### `ProductModerationHistory` — Lịch sử duyệt SP (Admin)

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `ModerationId` | BIGINT (PK) | ID | `1` |
| `ProductId` | UNIQUEIDENTIFIER (FK) | SP | GUID |
| `AdminUserId` | UNIQUEIDENTIFIER (FK) | Admin | GUID |
| `Action` | NVARCHAR(20) | Hành động | `Approve`, `Reject`, `RequestChange` |
| `FromStatus` / `ToStatus` | NVARCHAR(20) | Trạng thái trước/sau | `Pending` → `Approved` |
| `Reason` | NVARCHAR(500) | Lý do reject | `Missing warranty info` |
| `CreatedAt` | DATETIME2 | Thời điểm | UTC |

---

## 5. Giỏ hàng & Wishlist

### `Carts` — Giỏ hàng (1 user = 1 cart)

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `CartId` | UNIQUEIDENTIFIER (PK) | ID giỏ | GUID |
| `UserId` | UNIQUEIDENTIFIER (FK, unique) | Buyer | GUID |
| `CreatedAt` / `UpdatedAt` | DATETIME2 | Audit | UTC |

---

### `CartItems` — Dòng trong giỏ

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `CartItemId` | UNIQUEIDENTIFIER (PK) | ID dòng | GUID |
| `CartId` | UNIQUEIDENTIFIER (FK) | Giỏ | GUID |
| `ProductId` | UNIQUEIDENTIFIER (FK) | SP | GUID |
| `VariantId` | UNIQUEIDENTIFIER (FK, nullable) | Variant | `NULL` hoặc GUID |
| `Quantity` | INT | Số lượng | `2` |
| `UnitPriceSnapshot` | DECIMAL(18,2) | Giá lúc thêm giỏ (optional) | `12500000` |
| `CreatedAt` / `UpdatedAt` | DATETIME2 | Audit | UTC |

**Ràng buộc:** Mỗi cặp `(CartId, ProductId, VariantId)` chỉ 1 dòng.

---

### `WishlistItems` — Danh sách yêu thích

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `WishlistItemId` | UNIQUEIDENTIFIER (PK) | ID | GUID |
| `UserId` | UNIQUEIDENTIFIER (FK) | Buyer | GUID |
| `ProductId` | UNIQUEIDENTIFIER (FK) | SP | GUID |
| `CreatedAt` | DATETIME2 | Lúc thêm | UTC |

**Ràng buộc:** Mỗi user chỉ wishlist 1 lần / product.

---

## 6. Voucher

### `Vouchers` — Mã giảm giá

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `VoucherId` | UNIQUEIDENTIFIER (PK) | ID voucher | GUID |
| `Code` | NVARCHAR(40) | Mã (unique) | `AIDR10`, `TECHZONE50K` |
| `Name` | NVARCHAR(150) | Tên hiển thị | `Giảm 10% tối đa 100k` |
| `Description` | NVARCHAR(500) | Mô tả | |
| **`Scope`** | NVARCHAR(20) | Phạm vi | `System` (toàn sàn) hoặc `Shop` |
| `ShopId` | UNIQUEIDENTIFIER (FK) | Shop (bắt buộc nếu Scope=Shop) | GUID hoặc `NULL` |
| **`DiscountType`** | NVARCHAR(20) | Loại giảm | `Percent`, `FixedAmount` |
| **`DiscountValue`** | DECIMAL(18,2) | Giá trị giảm | `10` (%) hoặc `50000` (VND) |
| `MaxDiscountAmount` | DECIMAL(18,2) | Trần giảm (với %) | `100000` |
| `MinOrderAmount` | DECIMAL(18,2) | Đơn tối thiểu | `200000` |
| `UsageLimit` | INT | Tổng lượt dùng (null = ∞) | `1000` |
| `PerUserLimit` | INT | Lượt/user | `1` |
| `UsedCount` | INT | Đã dùng | `42` |
| `StartsAt` / `EndsAt` | DATETIME2 | Thời hạn | UTC |
| `IsActive` | BIT | Đang bật | `1` |
| `CreatedBy` | UNIQUEIDENTIFIER (FK) | Admin hoặc seller tạo | GUID |
| `CreatedAt` / `UpdatedAt` | DATETIME2 | Audit | UTC |

**Ví dụ:** Mã `TECHZONE50K` — giảm 50.000 VND, đơn tối thiểu 500.000, shop TechZone.

---

### `VoucherRedemptions` — Lịch sử dùng voucher

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `RedemptionId` | UNIQUEIDENTIFIER (PK) | ID | GUID |
| `VoucherId` | UNIQUEIDENTIFIER (FK) | Voucher | GUID |
| `UserId` | UNIQUEIDENTIFIER (FK) | Buyer dùng | GUID |
| `OrderId` | UNIQUEIDENTIFIER (FK) | Đơn áp dụng | GUID |
| `DiscountAmount` | DECIMAL(18,2) | Số tiền thực giảm | `50000` |
| `RedeemedAt` | DATETIME2 | Thời điểm | UTC |

---

## 7. Đơn hàng & Thanh toán

### `Orders` — Đơn hàng

> **Quy tắc:** 1 đơn = 1 shop. Giỏ nhiều shop → tách nhiều order.

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `OrderId` | UNIQUEIDENTIFIER (PK) | ID đơn | GUID |
| **`OrderCode`** | NVARCHAR(30) | Mã đơn hiển thị (unique) | `ORD-20260315-ABC123` |
| `BuyerUserId` | UNIQUEIDENTIFIER (FK) | Buyer | GUID |
| `ShopId` | UNIQUEIDENTIFIER (FK) | Shop bán | TechZone |
| `ShippingAddressId` | UNIQUEIDENTIFIER (FK) | Địa chỉ gốc | GUID |
| **`ShippingSnapshotJson`** | NVARCHAR(MAX) | **Snapshot địa chỉ lúc checkout** | JSON receiver/phone/address |
| **`Status`** | NVARCHAR(30) | Trạng thái đơn | Xem bảng dưới |
| `SubtotalAmount` | DECIMAL(18,2) | Tạm tính SP | `25000000` |
| `DiscountAmount` | DECIMAL(18,2) | Giảm voucher | `50000` |
| `ShippingFee` | DECIMAL(18,2) | Phí ship | `30000` |
| **`TotalAmount`** | DECIMAL(18,2) | Tổng thanh toán | `24980000` |
| `Currency` | CHAR(3) | Tiền tệ | `VND` |
| `VoucherId` | UNIQUEIDENTIFIER (FK) | Voucher đã dùng | GUID hoặc `NULL` |
| `BuyerNote` | NVARCHAR(500) | Ghi chú buyer | `Giao giờ hành chính` |
| `SellerNote` | NVARCHAR(500) | Ghi chú seller nội bộ | |
| `TrackingCode` | NVARCHAR(100) | Mã vận đơn | `GHN123456789` |
| `PaidAt` | DATETIME2 | Lúc thanh toán | UTC |
| `CancelledAt` | DATETIME2 | Lúc hủy | UTC |
| `DeliveredAt` | DATETIME2 | Lúc giao | UTC |
| `CompletedAt` | DATETIME2 | Lúc hoàn tất | UTC |
| `CreatedAt` / `UpdatedAt` | DATETIME2 | Audit | UTC |

**Luồng `Status` thường gặp:**

```
PendingPayment → Paid → Confirmed → Shipping → Delivered → Completed
                      ↘ Cancelled
                      ↘ ReturnRequested → Returned
```

---

### `OrderItems` — Dòng sản phẩm trong đơn

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `OrderItemId` | UNIQUEIDENTIFIER (PK) | ID dòng | GUID |
| `OrderId` | UNIQUEIDENTIFIER (FK) | Đơn | GUID |
| `ProductId` | UNIQUEIDENTIFIER (FK) | SP (tham chiếu) | GUID |
| `VariantId` | UNIQUEIDENTIFIER (FK) | Variant | `NULL` |
| **`ProductNameSnapshot`** | NVARCHAR(256) | Tên SP lúc mua | `Samsung Galaxy S24 256GB` |
| **`VariantNameSnapshot`** | NVARCHAR(150) | Tên variant lúc mua | `Orange / 128GB` |
| `SkuSnapshot` | NVARCHAR(64) | SKU lúc mua | `TZ-S24-256` |
| **`UnitPrice`** | DECIMAL(18,2) | **Giá bán lúc checkout** | `12500000` |
| **`UnitCostAvg`** | DECIMAL(18,2) | Giá vốn TB (COGS) | `10666667` |
| `Quantity` | INT | Số lượng | `1` |
| **`LineTotal`** | DECIMAL(18,2) | Thành tiền dòng | `12500000` |

> Snapshot đảm bảo đơn cũ không đổi khi seller sửa tên/giá SP sau này.

---

### `OrderItemLotAllocations` — Phân bổ FIFO theo lô (COGS)

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `AllocationId` | UNIQUEIDENTIFIER (PK) | ID | GUID |
| `OrderItemId` | UNIQUEIDENTIFIER (FK) | Dòng đơn | GUID |
| `LotId` | UNIQUEIDENTIFIER (FK) | Lô trừ tồn | LOT-20260110-001 |
| `Quantity` | INT | SL lấy từ lô | `1` |
| **`UnitCostSnapshot`** | DECIMAL(18,2) | Giá vốn lô tại lúc bán | `10000000` |

**Ví dụ:** Bán 2 máy FIFO → có thể 1 dòng allocation từ lô A (UnitCost 10tr) và 1 từ lô B (12tr).

---

### `OrderStatusHistories` — Lịch sử trạng thái đơn

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `HistoryId` | BIGINT (PK) | ID | `1` |
| `OrderId` | UNIQUEIDENTIFIER (FK) | Đơn | GUID |
| `FromStatus` | NVARCHAR(30) | Trạng thái cũ | `PendingPayment` |
| `ToStatus` | NVARCHAR(30) | Trạng thái mới | `Paid` |
| `ChangedBy` | UNIQUEIDENTIFIER (FK) | User/system | `NULL` = webhook |
| `Note` | NVARCHAR(300) | Ghi chú | `Payment succeeded via payOS webhook` |
| `CreatedAt` | DATETIME2 | Thời điểm | UTC |

---

### `Payments` — Thanh toán (payOS)

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `PaymentId` | UNIQUEIDENTIFIER (PK) | ID thanh toán | GUID |
| `OrderId` | UNIQUEIDENTIFIER (FK) | Đơn | GUID |
| `Provider` | NVARCHAR(30) | Cổng thanh toán | `payOS` |
| `ProviderPaymentId` | NVARCHAR(100) | ID link payOS | `abc-payment-link-id` |
| `Amount` | DECIMAL(18,2) | Số tiền | `24980000` |
| `Currency` | CHAR(3) | Tiền tệ | `VND` |
| **`Status`** | NVARCHAR(20) | Trạng thái | `Pending`, `Succeeded`, `Failed`, `Cancelled`, `Refunded` |
| `CheckoutUrl` | NVARCHAR(512) | URL redirect payOS | `https://pay.payos.vn/...` |
| `PaidAt` | DATETIME2 | Lúc thành công | UTC |
| `RawResponseJson` | NVARCHAR(MAX) | Payload payOS (debug) | JSON |
| `CreatedAt` / `UpdatedAt` | DATETIME2 | Audit | UTC |

---

## 8. Trả hàng (Returns)

### `ReturnRequests` — Yêu cầu trả hàng

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `ReturnRequestId` | UNIQUEIDENTIFIER (PK) | ID | GUID |
| `OrderId` | UNIQUEIDENTIFIER (FK) | Đơn gốc | GUID |
| `BuyerUserId` | UNIQUEIDENTIFIER (FK) | Buyer | GUID |
| `Reason` | NVARCHAR(500) | Lý do trả | `Device does not power on` |
| `Description` | NVARCHAR(2000) | Mô tả chi tiết | |
| `EvidenceUrls` | NVARCHAR(MAX) | JSON URL phụ (legacy) | `[]` |
| `ResolutionType` | NVARCHAR(20) | Hình thức xử lý | `ReturnRefund` \| `Exchange` |
| **`Status`** | NVARCHAR(30) | Trạng thái | `Pending` → `Approved` → `SellerConfirmed` → `Receiving` → `Accepted` → (`Refunded`\|`Exchanged`) → `Closed` (hoặc `Rejected`) |
| `RefundAmount` | DECIMAL(18,2) | Số tiền hoàn | `12500000` |
| `AdminNote` | NVARCHAR(500) | Ghi chú admin | |
| `ReviewedBy` / `ReviewedAt` | | Admin duyệt | GUID, UTC |
| `CreatedAt` / `UpdatedAt` | DATETIME2 | Audit | UTC |

---

### `ReturnRequestItems` — SP trong yêu cầu trả

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `ReturnItemId` | UNIQUEIDENTIFIER (PK) | ID | GUID |
| `ReturnRequestId` | UNIQUEIDENTIFIER (FK) | Yêu cầu trả | GUID |
| `OrderItemId` | UNIQUEIDENTIFIER (FK) | Dòng đơn gốc | GUID |
| `Quantity` | INT | SL trả | `1` |

---

### `ReturnEvidences` — Video/ảnh bằng chứng trả hàng

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `EvidenceId` | UNIQUEIDENTIFIER (PK) | ID | GUID |
| `ReturnRequestId` | UNIQUEIDENTIFIER (FK) | Yêu cầu trả | GUID |
| **`EvidenceType`** | NVARCHAR(20) | Loại | `Unboxing`, `Testing`, `Other` |
| `MediaUrl` | NVARCHAR(512) | URL Cloudinary | Video mở hộp / test máy |
| `PublicId` | NVARCHAR(256) | Cloudinary public id | |
| `SortOrder` | INT | Thứ tự | `0` |
| `CreatedAt` | DATETIME2 | Audit | UTC |

> **Yêu cầu nghiệp vụ:** Tối thiểu 1 Unboxing + 1 Testing khi tạo return.

---

### `ReturnStatusHistories` — Lịch sử trạng thái trả hàng

Cấu trúc giống `OrderStatusHistories`: `FromStatus`, `ToStatus`, `ChangedBy`, `Note`, `CreatedAt`.

---

## 9. Đánh giá sản phẩm

### `ProductReviews` — Review SP

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `ReviewId` | UNIQUEIDENTIFIER (PK) | ID | GUID |
| `ProductId` | UNIQUEIDENTIFIER (FK) | SP | GUID |
| `BuyerUserId` | UNIQUEIDENTIFIER (FK) | Buyer | GUID |
| `OrderId` | UNIQUEIDENTIFIER (FK) | Đơn mua (verified) | GUID |
| **`Rating`** | TINYINT | Sao 1–5 | `5` |
| `Title` | NVARCHAR(150) | Tiêu đề review | `Great phone!` |
| `Content` | NVARCHAR(2000) | Nội dung | `Battery lasts all day...` |
| `SentimentLabel` | NVARCHAR(20) | Nhãn AI | `Positive`, `Neutral`, `Negative` |
| `SentimentScore` | DECIMAL(5,4) | Điểm sentiment | `0.9234` |
| `IsVisible` | BIT | Hiển thị công khai | `1` |
| `CreatedAt` / `UpdatedAt` | DATETIME2 | Audit | UTC |

---

## 10. Thông báo & Chat

### `Notifications` — Thông báo in-app

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `NotificationId` | UNIQUEIDENTIFIER (PK) | ID | GUID |
| `UserId` | UNIQUEIDENTIFIER (FK) | Người nhận | GUID |
| `Title` | NVARCHAR(200) | Tiêu đề | `New chat message` |
| `Body` | NVARCHAR(1000) | Nội dung | `Nguyen Van Seller: Hello...` |
| **`Type`** | NVARCHAR(40) | Loại | `Order`, `Payment`, `Moderation`, `Chat`, `System`, `Promo` |
| `ReferenceType` | NVARCHAR(40) | Loại đích | `ChatThread`, `Order`, `Product` |
| `ReferenceId` | UNIQUEIDENTIFIER | ID đích | ThreadId, OrderId… |
| `IsRead` | BIT | Đã đọc | `0` |
| `CreatedAt` | DATETIME2 | Thời điểm (có thể bump khi chat gộp) | UTC |

**Ví dụ chat:** Nhiều tin trong cùng thread → 1 notification unread, cập nhật `Body`/`CreatedAt`.

---

### `ChatThreads` — Hội thoại buyer ↔ shop

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `ThreadId` | UNIQUEIDENTIFIER (PK) | ID thread | GUID |
| `BuyerUserId` | UNIQUEIDENTIFIER (FK) | Buyer | GUID |
| `ShopId` | UNIQUEIDENTIFIER (FK) | Shop | TechZone |
| `ProductId` | UNIQUEIDENTIFIER (FK, nullable) | SP ngữ cảnh (optional) | GUID khi chat từ trang SP |
| `LastMessageAt` | DATETIME2 | Tin cuối | UTC |
| `CreatedAt` | DATETIME2 | Audit | UTC |

**Ràng buộc:** 1 buyer + 1 shop = tối đa 1 thread.

---

### `ChatMessages` — Tin nhắn chat

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `MessageId` | UNIQUEIDENTIFIER (PK) | ID tin | GUID |
| `ThreadId` | UNIQUEIDENTIFIER (FK) | Thread | GUID |
| `SenderUserId` | UNIQUEIDENTIFIER (FK) | Người gửi | Buyer hoặc shop owner |
| `Content` | NVARCHAR(2000) | Nội dung text | `Hello, is this in stock?` hoặc chứa link SP |
| `AttachmentUrl` | NVARCHAR(512) | Ảnh/file đính kèm | Cloudinary URL |
| `IsRead` | BIT | Đã đọc bởi peer | `0` |
| `CreatedAt` | DATETIME2 | Thời điểm gửi | UTC |

**Ví dụ share SP:** Content có `/products/{guid}` → FE render card, không hiện URL thô.

---

## 11. Ví Seller (Wallet)

### `Wallets` — Số dư shop

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `WalletId` | UNIQUEIDENTIFIER (PK) | ID ví | GUID |
| `ShopId` | UNIQUEIDENTIFIER (FK, unique) | Shop | 1 shop = 1 ví |
| **`AvailableBalance`** | DECIMAL(18,2) | Số dư rút được | `15000000` |
| **`PendingBalance`** | DECIMAL(18,2) | Đang chờ settle | `3000000` |
| `Currency` | CHAR(3) | Tiền tệ | `VND` |
| `UpdatedAt` | DATETIME2 | Cập nhật gần nhất | UTC |

---

### `WalletTransactions` — Sổ cái ví

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `WalletTxId` | BIGINT (PK) | ID | `1` |
| `WalletId` | UNIQUEIDENTIFIER (FK) | Ví | GUID |
| **`TxType`** | NVARCHAR(30) | Loại GD | `OrderCredit`, `RefundDebit`, `Withdrawal`, `Adjustment` |
| `Amount` | DECIMAL(18,2) | Số tiền (+/-) | `12500000` |
| `BalanceAfter` | DECIMAL(18,2) | Số dư sau GD | `27500000` |
| `ReferenceType` | NVARCHAR(40) | Tham chiếu | `Order` |
| `ReferenceId` | UNIQUEIDENTIFIER | ID tham chiếu | OrderId |
| `Note` | NVARCHAR(300) | Ghi chú | |
| `CreatedAt` | DATETIME2 | Thời điểm | UTC |

---

## 12. AI & Hành vi người dùng

### `ViewedProductHistories` — Lịch sử xem SP

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `ViewId` | BIGINT (PK) | ID | `1` |
| `UserId` | UNIQUEIDENTIFIER (FK, nullable) | User (null = guest) | GUID |
| `SessionId` | NVARCHAR(64) | Session guest | `sess_abc123` |
| `ProductId` | UNIQUEIDENTIFIER (FK) | SP đã xem | GUID |
| `ViewedAt` | DATETIME2 | Thời điểm | UTC |

---

### `ProductRecommendations` — Gợi ý SP (precomputed)

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `RecommendationId` | BIGINT (PK) | ID | `1` |
| `UserId` | UNIQUEIDENTIFIER (FK) | User | GUID |
| `ProductId` | UNIQUEIDENTIFIER (FK) | SP gợi ý | GUID |
| `Score` | DECIMAL(9,6) | Điểm relevance | `0.874521` |
| **`Strategy`** | NVARCHAR(40) | Thuật toán | `Collaborative`, `Content`, `Hybrid`, `Popular` |
| `GeneratedAt` | DATETIME2 | Lúc tính | UTC |

---

### `AiConversations` — Phiên chat AI

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `ConversationId` | UNIQUEIDENTIFIER (PK) | ID phiên | GUID |
| `UserId` | UNIQUEIDENTIFIER (FK) | User | GUID |
| **`Channel`** | NVARCHAR(30) | Kênh AI | `ShoppingAssistant`, `Compare`, `NlFilter` |
| `Title` | NVARCHAR(200) | Tiêu đề phiên | `Find phone under 15M` |
| `CreatedAt` / `UpdatedAt` | DATETIME2 | Audit | UTC |

---

### `AiMessages` — Tin nhắn trong phiên AI

| Trường | Kiểu | Mô tả | Ví dụ |
|--------|------|--------|-------|
| `AiMessageId` | BIGINT (PK) | ID | `1` |
| `ConversationId` | UNIQUEIDENTIFIER (FK) | Phiên | GUID |
| **`Role`** | NVARCHAR(20) | Vai trò | `user`, `assistant`, `system` |
| `Content` | NVARCHAR(MAX) | Nội dung | Câu hỏi / trả lời AI |
| `MetaJson` | NVARCHAR(MAX) | Metadata | Filter JSON, product ids… |
| `CreatedAt` | DATETIME2 | Thời điểm | UTC |

**Ví dụ `MetaJson` (NlFilter):**
```json
{"filters":{"maxPrice":15000000,"category":"dien-thoai"},"productIds":["..."]}
```

---

## Views hữu ích (tham khảo)

| View | Mục đích |
|------|----------|
| `vw_SellerSalesSummary` | Doanh thu theo shop/ngày |
| `vw_ProductStockByLot` | Tồn theo lô + ước tính margin/đơn vị |

---

## Tài khoản demo (seed)

| Vai trò | Email | Mật khẩu (dev) |
|---------|-------|----------------|
| Admin | `admin@aidr.local` | (theo seed dev) |
| Seller | `seller@aidr.local` | |
| Buyer | `buyer@aidr.local` | |

Shop demo: **TechZone Official** (`techzone-official`)  
SP demo: **Samsung Galaxy S24 256GB** — 2 lô nhập giá vốn 10tr và 12tr.

---

*Nguồn schema: [`database.sql`](../database.sql) — cập nhật khi schema thay đổi.*

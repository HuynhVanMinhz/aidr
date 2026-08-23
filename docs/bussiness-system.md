# AIDR — Business System Document

**Project:** Building an AI-Integrated Digital Retail System (AIDR)  
**Code:** AIDR | **Group:** SE_11  
**Stack:** ReactJS · .NET · SQL Server · AI (Ollama)

---

## 1. Tổng quan hệ thống

AIDR là nền tảng **bán lẻ điện tử đa người bán (multi-vendor e-commerce)** tích hợp AI, giúp người mua tìm sản phẩm phù hợp nhanh hơn và giúp người bán / admin vận hành hiệu quả hơn.

Hệ thống giải quyết các pain point chính:
- Quá tải thông tin khi chọn sản phẩm điện tử
- Thiếu trải nghiệm mua sắm cá nhân hóa
- Hỗ trợ khách hàng chậm / hạn chế
- Khó theo dõi doanh số và hành vi khách hàng

**Vision:** Trở thành nền tảng bán lẻ điện tử tích hợp AI, cung cấp gợi ý thông minh, chatbot hỗ trợ, và báo cáo dữ liệu cho quyết định kinh doanh.

---

## 2. Actors

| Actor | Mô tả |
|-------|--------|
| **Guest** | Người chưa đăng nhập; xem catalog, tìm kiếm, xem đánh giá |
| **Buyer** | Người mua đã đăng ký; giỏ hàng, đơn hàng, wishlist, AI, chat, follow seller |
| **Seller** | Cửa hàng; quản lý sản phẩm, đơn hàng, voucher shop, ví, dashboard |
| **Admin** | Quản trị viên; duyệt sản phẩm/seller, category, voucher hệ thống, return, khóa tài khoản |

---

## 3. Phạm vi nghiệp vụ (Major Features)

| ID | Nhóm chức năng | Mô tả ngắn |
|----|----------------|------------|
| FE-01 | Auth & Profile | Đăng ký, đăng nhập (email/Google), quên/đổi MK, hồ sơ |
| FE-02 | Product & Category | CRUD sản phẩm, ảnh, tồn kho theo lô (giá nhập), duyệt SP, danh mục |
| FE-02b | Pricing & Stock Lot | Nhập lô hàng (cost), cập nhật giá bán catalog độc lập |
| FE-03 | Search & AI Filter | Tìm kiếm, lọc/sắp xếp, AI so sánh, NL → filter |
| FE-04 | Cart / Order / Payment | Giỏ hàng, voucher, tạo đơn, thanh toán payOS, hủy/nhận hàng |
| FE-05 | Return & Refund | Buyer yêu cầu; Admin duyệt/cập nhật trạng thái |
| FE-06 | Wishlist & Follow | Wishlist; follow/unfollow seller |
| FE-07 | Review & Rating | Đánh giá SP; đánh giá seller |
| FE-08 | AI & Recommendation | Gợi ý SP, SP tương tự, chatbot mua sắm |
| FE-09 | Chat & Notification | Chat buyer↔seller (SignalR); thông báo realtime |
| FE-10 | Seller Center | Dashboard, báo cáo bán hàng, ví, voucher shop |
| FE-11 | Admin | Tài khoản, đăng ký seller, voucher hệ thống, insights |

### Giới hạn (từ Report)
- Không auto-moderation tranh chấp return phức tạp (Admin xử lý thủ công)
- Không tích hợp API vận chuyển realtime (GHN/GHTK) — seller tự cập nhật tracking
- Không live streaming

---

## 4. Use Case Catalog (mapping Actor)

### 4.1 Identity & Profile

| UC | Use Case | Actor |
|----|----------|-------|
| UC-01 | Register Account | Guest |
| UC-02 | Login With Email / Password | Guest |
| UC-03 | Login With Google | Guest |
| UC-04 | Logout | Buyer / Seller / Admin |
| UC-05 | Forget Password | Guest |
| UC-06 | Change Password | Buyer / Seller |
| UC-07 | View Profile | Buyer / Seller |
| UC-08 | Update Profile | Buyer / Seller |

### 4.2 Catalog & Product (Buyer / Guest)

| UC | Use Case | Actor |
|----|----------|-------|
| UC-09 | View Product List | Guest / Buyer |
| UC-10 | View Product Details | Guest / Buyer |
| UC-11 | View Product Categories | Guest / Buyer |
| UC-26 | Search Products | Guest / Buyer |
| UC-27 | Filter & Sort Products | Guest / Buyer |
| UC-28 | AI Compare Products | Buyer |
| UC-90 | AI — convert natural language to filter | Buyer / Guest |

### 4.3 Seller Product Lifecycle

| UC | Use Case | Actor |
|----|----------|-------|
| UC-12 | Create Product | Seller |
| UC-13 | Upload Image Product | Seller |
| UC-14 | Update Product | Seller |
| UC-15 | Delete Product | Seller |
| UC-16 | View My Products | Seller |
| UC-17 | Manage Product Inventory | Seller |
| UC-91 | Import Stock Lot (nhập kho theo lô + giá vốn) | Seller |
| UC-92 | Update Selling Price (giá bán trên web) | Seller |

### 4.4 Admin Product & Category Moderation

| UC | Use Case | Actor |
|----|----------|-------|
| UC-18 | View Product List (Admin) | Admin |
| UC-19 | Approve Product | Admin |
| UC-20 | Reject Product | Admin |
| UC-21 | View Moderation History | Admin |
| UC-22 | Create Category | Admin |
| UC-23 | Update Category | Admin |
| UC-24 | Delete Category | Admin |
| UC-25 | Activate / Disable Category | Admin |

### 4.5 Cart, Voucher, Checkout, Payment

| UC | Use Case | Actor |
|----|----------|-------|
| UC-29 | View Cart | Buyer |
| UC-30 | Add Product to Cart | Buyer |
| UC-31 | Remove Product from Cart | Buyer |
| UC-32 | View Voucher | Buyer |
| UC-33 | Apply Voucher | Buyer |
| UC-34 | Create Order | Buyer |
| UC-35 | Make Payment | Buyer |

### 4.6 Wishlist

| UC | Use Case | Actor |
|----|----------|-------|
| UC-36 | View Wishlist | Buyer |
| UC-37 | Add Product to Wishlist | Buyer |
| UC-38 | Delete Product from Wishlist | Buyer |

### 4.7 Orders (Buyer / Seller)

| UC | Use Case | Actor |
|----|----------|-------|
| UC-39 | View Purchased Orders | Buyer |
| UC-40 | View Order Details | Buyer |
| UC-41 | Cancel Order | Buyer |
| UC-42 | Confirm Received | Buyer |
| UC-46 | View Order List | Seller |
| UC-47 | Update Order Status | Seller |

### 4.8 Return / Refund

| UC | Use Case | Actor |
|----|----------|-------|
| UC-43 | Request Return / Refund | Buyer |
| UC-48 | View Return Requests | Admin |
| UC-49 | View Return Request Details | Admin |
| UC-50 | Approve / Reject Return Request | Admin |
| UC-52 | Update Return Request Status | Admin |

### 4.9 Notifications & Chat

| UC | Use Case | Actor |
|----|----------|-------|
| UC-44 | View Notifications | Buyer / Seller |
| UC-45 | Delete Notification | Buyer / Seller |
| UC-57 | View Chat List | Buyer / Seller |
| UC-58 | Send Message | Buyer / Seller |

### 4.10 AI & Discovery

| UC | Use Case | Actor |
|----|----------|-------|
| UC-53 | View Recommended Products | Buyer |
| UC-54 | View Similar Products | Buyer |
| UC-56 | Use AI Shopping Assistant (Chatbot) | Buyer |

### 4.11 Reviews, Seller Social

| UC | Use Case | Actor |
|----|----------|-------|
| UC-59 | View Product Reviews | Guest / Buyer |
| UC-60 | Add Product Review | Buyer |
| UC-61 | Update Product Review | Buyer |
| UC-62a | Delete Product Review | Buyer |
| UC-62b | Get Seller Detail | Buyer |
| UC-63 | Rate Seller | Buyer |
| UC-64 | View Seller Rating | Guest / Buyer |
| UC-65 | Follow Seller | Buyer |
| UC-66 | Unfollow Seller | Buyer |
| UC-67 | View List Follow | Buyer |

### 4.12 Seller Center & Wallet

| UC | Use Case | Actor |
|----|----------|-------|
| UC-69 | View Seller Dashboard | Seller |
| UC-70 | View Sales Reports | Seller |
| UC-85 | View Wallet | Seller |
| UC-87 | Create Voucher for My Shop | Seller |
| UC-88 | Update Voucher for My Shop | Seller |
| UC-89 | Delete Voucher for My Shop | Seller |

### 4.13 Admin Governance

| UC | Use Case | Actor |
|----|----------|-------|
| UC-71 | View Customer Insights | Admin |
| UC-72 | View Account List | Admin |
| UC-73 | Lock User Account | Admin |
| UC-74 | Unlock User Account | Admin |
| UC-75 | View Seller Registration Requests | Admin |
| UC-76 | Approve / Reject Seller Registration | Admin |
| UC-78 | Create Voucher in System | Admin |
| UC-79 | Update Voucher in System | Admin |
| UC-80 | Delete Voucher in System | Admin |
| UC-81 | Activate / Disable Voucher | Admin |

> **Ghi chú numbering:** UC-51, UC-55, UC-68, UC-77, UC-82–84, UC-86 không nằm trong danh sách hiện tại (có thể reserved / out of MVP). UC-62 bị trùng ID trong SRS → tách thành **UC-62a** (Delete Review) và **UC-62b** (Get Seller Detail).

---

## 5. Luồng nghiệp vụ chính

### 5.1 Onboarding & Auth
1. Guest đăng ký (UC-01) hoặc Login Google (UC-03).
2. Keycloak / .NET xác thực → JWT → FE lưu session (Redux).
3. User quên MK → email reset token (UC-05); đổi MK khi đã login (UC-06).

### 5.2 Seller join platform
1. Buyer gửi **Seller Registration Request**.
2. Admin duyệt / từ chối (UC-75, UC-76).
3. Khi duyệt → gán role Seller + tạo hồ sơ Shop + Wallet.

### 5.3 Product publish
1. Seller tạo SP + upload ảnh Cloudinary (UC-12, UC-13) → trạng thái `Pending`.
2. Admin Approve / Reject + ghi Moderation History (UC-19–21).
3. Chỉ SP `Approved` + Category `Active` mới hiện catalog.

### 5.4 Mua hàng
1. Buyer thêm giỏ (UC-30) → áp voucher (UC-33) → Create Order (UC-34).
2. Thanh toán qua **payOS** (UC-35) → cập nhật Payment + Order status.
3. Seller cập nhật trạng thái đơn (UC-47); Buyer Confirm Received (UC-42) hoặc Cancel (UC-41) theo rule.

### 5.5 Return
1. Buyer Request Return (UC-43).
2. Admin xem / duyệt / cập nhật status (UC-48–52).
3. Hoàn tiền theo policy (không auto-dispute AI).

### 5.6 AI-assisted shopping
1. **UC-90:** câu tiếng tự nhiên → bộ filter/search.
2. **UC-28:** so sánh nhiều SP bằng LLM (Ollama).
3. **UC-53/54:** recommendation & similar từ hành vi + catalog.
4. **UC-56:** chatbot tư vấn mua sắm (SignalR / HTTP streaming tới Ollama).

---

## 6. Quy tắc nghiệp vụ cốt lõi (Business Rules)

| ID | Rule |
|----|------|
| BR-01 | Email unique trong hệ thống |
| BR-02 | Password ≥ 8 ký tự, có chữ hoa + ký tự đặc biệt |
| BR-03 | 5 lần login sai liên tiếp → khóa tạm 15 phút |
| BR-04 | Token chứa `userId` + roles cho Role Guard |
| BR-05 | Avatar ≤ 2MB |
| BR-06 | Tối đa 10 địa chỉ / user |
| BR-12 | Profile Phone bắt buộc; định dạng SĐT VN hợp lệ (0[35789]xxxxxxxx hoặc +84…) |
| BR-07/08 | Đổi MK cần MK cũ đúng; Confirm khớp New Password |
| BR-09–11 | Reset link chỉ gửi email đã đăng ký; one-time; hết hạn |
| BR-P01 | Chỉ Seller sở hữu SP mới CRUD / inventory |
| BR-P02 | SP mới mặc định Pending; chỉ Admin đổi Approved/Rejected |
| BR-O01 | Chỉ hủy đơn ở trạng thái cho phép (Pending / Unpaid) |
| BR-O02 | Confirm Received chỉ khi đơn Delivered |
| BR-V01 | Voucher System do Admin; Voucher Shop do Seller; scope không chồng sai |
| BR-V02 | Mỗi voucher có hạn dùng, min order, usage limit |
| BR-W01 | Wallet Seller tăng khi đơn hoàn tất (sau Confirm Received / policy) |
| BR-C01 | Giá bán (BasePrice/SalePrice) và giá nhập (InventoryLots.UnitCost) tách biệt |
| BR-C02 | Mỗi lần nhập kho tạo lô mới; không overwrite UnitCost lô đã có |
| BR-C03 | Trừ tồn bán hàng theo FIFO (mặc định) hoặc WeightedAverage theo Shop.CostingMethod |
| BR-C04 | Đổi giá bán chỉ ghi ProductPriceHistories; không đụng lô / đơn đã bán |
| BR-C05 | OrderItems snapshot UnitPrice; COGS snapshot qua OrderItemLotAllocations |

---

## 6b. Logic giá nhập theo lô vs giá bán (UC-91 / UC-92)

**Bài toán:** Nhập 10 điện thoại @ 10tr/cái, đăng bán 11tr. Sau này giá vốn tăng/giảm — xử lý thế nào?

| Khái niệm | Lưu ở đâu | Khi nào đổi |
|-----------|-----------|-------------|
| Giá bán trên web | `Products.BasePrice` / `SalePrice` | Seller đổi tự do (UC-92) → `ProductPriceHistories` |
| Giá nhập / giá vốn | `InventoryLots.UnitCost` theo từng lô | Chỉ khi **nhập lô mới** (UC-91); lô cũ giữ nguyên |
| Tồn hiển thị | `Products.StockQuantity` = Σ `QuantityRemaining` | Cộng khi nhập lô; trừ khi bán (FIFO) |
| Lãi ước tính | `AvgCostPrice`, view `vw_ProductStockByLot` | Recalc sau nhập/xuất |

**Ví dụ:**
1. Lô A: 10 sp @ 10.000.000 — bán 11.000.000.
2. Thị trường tăng → nhập Lô B: 5 sp @ 12.000.000; có thể nâng giá bán lên 12.500.000.
3. Lô A vẫn UnitCost=10tr; đơn đã bán trước đó không bị sửa.
4. Bán tiếp 12 máy (FIFO): 10 từ A @10tr + 2 từ B @12tr → COGS TB dòng = 10.333.333; doanh thu theo giá bán hiện tại.

**Kết luận:** Có cần cập nhật DB? **Có** — thêm `InventoryLots`, `ProductPriceHistories`, `OrderItemLotAllocations` (đã có trong `database.sql`). Không chỉ sửa 1 cột “cost” trên Products.

## 7. Thực thể nghiệp vụ (Business Entities)

| Entity | Vai trò |
|--------|---------|
| User / Role | Tài khoản & phân quyền |
| Shop (Seller Profile) | Hồ sơ cửa hàng |
| SellerRegistration | Yêu cầu trở thành seller |
| Category | Phân loại sản phẩm |
| Product / ProductImage / Inventory | Catalog & tồn kho |
| InventoryLot | Lô nhập kho + UnitCost (giá vốn) |
| ProductPriceHistory | Lịch sử đổi giá bán |
| OrderItemLotAllocation | Phân bổ COGS theo lô khi bán |
| ProductModeration | Lịch sử duyệt SP |
| Cart / CartItem | Giỏ hàng |
| Voucher / VoucherRedemption | Khuyến mãi |
| Order / OrderItem / Payment | Đơn & thanh toán |
| ReturnRequest | Hoàn hàng / hoàn tiền |
| WishlistItem | Yêu thích |
| ProductReview / SellerRating | Đánh giá |
| SellerFollow | Theo dõi seller |
| Notification | Thông báo |
| ChatThread / ChatMessage | Chat realtime |
| Wallet / WalletTransaction | Ví seller |
| ViewedProductHistory | Hành vi xem SP (cho AI) |
| AiConversation | Lịch sử chatbot (tùy chọn) |

Chi tiết schema: xem `database.sql`.

---

## 8. Tích hợp bên ngoài (Business view)

| Service | Mục đích nghiệp vụ |
|---------|-------------------|
| **Keycloak** (+ Google IdP) | AuthN / AuthZ, Login Google |
| **Cloudinary** | Upload / CDN ảnh sản phẩm & avatar |
| **payOS** | Thanh toán online |
| **Ollama** | Chatbot, so sánh SP, NL→filter, hỗ trợ recommendation text |
| **SMTP / Email** | Reset password, thông báo quan trọng |
| **Redis** | Cache catalog / session phụ trợ |
| **SignalR** | Chat & notification realtime |
| **Aiven + SQL Server** | Lưu trữ dữ liệu chính |
| **Grafana** | Giám sát vận hành (NFR) |

---

## 9. Ma trận Actor × Capability (tóm tắt)

| Capability | Guest | Buyer | Seller | Admin |
|------------|:-----:|:-----:|:------:|:-----:|
| Browse / Search / Filter | ✓ | ✓ | — | — |
| AI Compare / Chatbot / Recommend | — | ✓ | — | — |
| Cart / Checkout / Wishlist | — | ✓ | — | — |
| Product CRUD / Inventory | — | — | ✓ | — |
| Moderate Product / Category | — | — | — | ✓ |
| Manage Shop Orders / Wallet | — | — | ✓ | — |
| System Voucher / Lock User / Seller Approve | — | — | — | ✓ |
| Chat / Notifications | — | ✓ | ✓ | — |

---

## 10. Tài liệu liên quan

| File | Nội dung |
|------|----------|
| `database.sql` | Schema SQL Server mới |
| `architecture-aidr-be.md` | Kiến trúc backend (.NET) |
| `architecture-aidr-fe.md` | Kiến trúc frontend (React) |
| `Report7_Final Project Report.docx` | SRS / SDD gốc |

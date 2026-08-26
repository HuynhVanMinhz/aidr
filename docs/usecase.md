# AIDR — Use Case Catalog

**Legend**

| Field | Values |
|-------|--------|
| **status** | `Todo` · `In Progress` · `Done` · `Blocked` |
| **priority** | `P0` (MVP bắt buộc) · `P1` (MVP+ quan trọng) · `P2` (nên có) · `P3` (nice-to-have) |

> Cập nhật cột **status** khi làm việc. Actor ghi trong description.

---

## Use Cases

| id | name | description (chi tiết + business) | status | priority |
|----|------|-------------------------------------|--------|----------|
| UC-01 | Register Account | **Actor:** Guest. Khách nhập Full Name, Email, Password; hệ thống validate (email unique, password đủ phức tạp — BR-01/02), tạo tài khoản Buyer, gửi xác nhận email (nếu bật). **Business:** Mở rộng user base; mọi giao dịch mua bắt đầu từ account. | Done | P0 |
| UC-02 | Login With Email / Password | **Actor:** Guest. Xác thực credentials; kiểm tra Active/Locked; sau 5 lần sai khóa tạm 15 phút (BR-03); trả JWT + roles. **Business:** Cổng vào hệ thống cho mọi role. | Done | P0 |
| UC-03 | Login With Google | **Actor:** Guest. OAuth/OIDC qua Keycloak + Google IdP; lần đầu upsert user app. **Business:** Giảm ma sát đăng ký, tăng conversion. | Done | P0 |
| UC-04 | Logout | **Actor:** Buyer/Seller/Admin. Invalidate session/refresh; xóa token phía client. **Business:** Bảo mật phiên đăng nhập. | Done | P0 |
| UC-05 | Forget Password | **Actor:** Guest. Nhập email đã đăng ký → token one-time có hạn → reset password (BR-09..11). **Business:** Giảm mất user do quên mật khẩu. | Done | P0 |
| UC-06 | Change Password | **Actor:** Buyer/Seller. Yêu cầu mật khẩu cũ đúng; New = Confirm; hash lưu lại (BR-07/08). **Business:** Bảo mật tài khoản chủ động. | Done | P1 |
| UC-07 | View Profile | **Actor:** Buyer/Seller. Xem thông tin cá nhân, avatar, SĐT, địa chỉ mặc định. **Business:** Minh bạch dữ liệu tài khoản. | Done | P0 |
| UC-08 | Update Profile | **Actor:** Buyer/Seller. Cập nhật tên, SĐT, avatar (≤2MB), địa chỉ (≤10 — BR-05/06). **Business:** Dữ liệu giao hàng / liên hệ chính xác. | Done | P0 |
| UC-09 | View Product List | **Actor:** Guest/Buyer. Danh sách SP `Approved` + category Active; phân trang; cache Redis. **Business:** Catalog là bề mặt bán hàng chính. | Done | P0 |
| UC-10 | View Product Details | **Actor:** Guest/Buyer. Chi tiết SP, ảnh, specs, giá bán, tồn, shop, reviews tóm tắt; ghi viewed history. **Business:** Hỗ trợ quyết định mua. | Done | P0 |
| UC-11 | View Product Categories | **Actor:** Guest/Buyer. Cây danh mục đang Active để điều hướng. **Business:** Tổ chức catalog theo ngành hàng điện tử. | Done | P0 |
| UC-12 | Create Product | **Actor:** Seller. Tạo SP thuộc shop; status mặc định `Pending`; nhập mô tả, brand, model, giá bán… **Business:** Seller mở rộng catalog; cần Admin duyệt trước khi lên kệ. | Done | P0 |
| UC-13 | Upload Image Product | **Actor:** Seller. Upload Cloudinary → lưu URL/publicId vào ProductImages. **Business:** Media chất lượng tăng trust & conversion. | Done | P0 |
| UC-14 | Update Product | **Actor:** Seller (owner). Sửa thông tin SP thuộc shop; **reset status → Pending** để Admin duyệt lại (BR-P03). **Business:** Giữ thông tin SP cập nhật; không lên kệ lại khi chưa duyệt. | Done | P0 |
| UC-15 | Delete Product | **Actor:** Seller. Soft-delete / Inactive; không xóa cứng nếu đã có order. **Business:** Dọn catalog; bảo toàn lịch sử đơn. | Done | P1 |
| UC-16 | View My Products | **Actor:** Seller. List SP của shop theo status (Draft/Pending/Approved…). **Business:** Quản lý danh mục bán. | Done | P0 |
| UC-17 | Manage Product Inventory | **Actor:** Seller. Xem tồn, reserved, low-stock; **so sánh giá bán vs giá nhập (AvgCost / UnitCost lô)** → Est. margin/unit; điều chỉnh thủ công có ghi InventoryTransactions; khi vừa chuyển sang low-stock → System notification (SignalR). **Business:** Tránh oversell; biết lời lãi từng SP (BR-C06). | Done | P0 |
| UC-18 | View Product List (Admin) | **Actor:** Admin. Queue toàn bộ SP (ưu tiên Pending). **Business:** Kiểm soát chất lượng catalog. | Done | P0 |
| UC-19 | Approve Product | **Actor:** Admin. Pending → Approved; ghi moderation history. **Business:** SP đủ chuẩn mới hiện buyer. | Done | P0 |
| UC-20 | Reject Product | **Actor:** Admin. Pending → Rejected + lý do; Seller xem reason → sửa (UC-14) hoặc bỏ SP. **Business:** Chặn SP sai/thiếu thông tin; vòng duyệt lại. | Done | P0 |
| UC-21 | View Moderation History | **Actor:** Admin. Timeline Approve/Reject theo product. **Business:** Audit & tranh chấp. | Done | P1 |
| UC-22 | Create Category | **Actor:** Admin. Tạo category (parent/child, slug unique). **Business:** Cấu trúc ngành hàng. | Done | P0 |
| UC-23 | Update Category | **Actor:** Admin. Sửa tên, mô tả, ảnh, sort, parent (không tạo vòng lặp). **Business:** Duy trì taxonomy. | Done | P1 |
| UC-24 | Delete Category | **Actor:** Admin. Xóa khi không còn SP phụ thuộc (hoặc soft). **Business:** Tránh orphan catalog. | Done | P2 |
| UC-25 | Activate / Disable Category | **Actor:** Admin. Bật/tắt hiển thị category. **Business:** Ẩn nhóm hàng tạm thời. | Done | P1 |
| UC-26 | Search Products | **Actor:** Guest/Buyer. Full-text / keyword trên name, brand, specs. **Business:** Giảm thời gian tìm SP. | Done | P0 |
| UC-27 | Filter & Sort Products | **Actor:** Guest/Buyer. Lọc category, brand, giá, rating; sort price/newest/popular. **Business:** Thu hẹp lựa chọn khi catalog lớn. | Done | P0 |
| UC-28 | AI Compare Products | **Actor:** Buyer. Chọn 2–N SP → Ollama tóm tắt so sánh theo specs. **Business:** Hỗ trợ quyết định mua điện tử phức tạp. | Done | P2 |
| UC-29 | View Cart | **Actor:** Buyer. Xem items, qty, giá snapshot, tổng. **Business:** Chuẩn bị checkout. | Done | P0 |
| UC-30 | Add Product to Cart | **Actor:** Buyer. Thêm SP Approved còn tồn; gộp qty nếu trùng. **Business:** Capture intent mua. | Done | P0 |
| UC-31 | Remove Product from Cart | **Actor:** Buyer. Xóa / giảm qty item. **Business:** Sửa giỏ trước thanh toán. | Done | P0 |
| UC-32 | View Voucher | **Actor:** Buyer. List voucher System + Shop đang hiệu lực & đủ điều kiện. **Business:** Thúc đẩy conversion bằng KM. | Done | P1 |
| UC-33 | Apply Voucher | **Actor:** Buyer. Preview/apply giảm giá theo min order, limit, scope. **Business:** Áp dụng đúng policy KM. | Done | P1 |
| UC-34 | Create Order | **Actor:** Buyer. Split theo shop; snapshot địa chỉ & giá; reserve stock; tạo Payment pending. **Business:** Chốt đơn mua. | Done | P0 |
| UC-35 | Make Payment | **Actor:** Buyer. Tạo link payOS; webhook cập nhật Paid. **Business:** Thu tiền online an toàn. | Done | P0 |
| UC-36 | View Wishlist | **Actor:** Buyer. Danh sách SP yêu thích. **Business:** Lưu SP quan tâm để mua sau. | Done | P1 |
| UC-37 | Add Product to Wishlist | **Actor:** Buyer. Thêm SP (unique user+product). **Business:** Retention & remarketing. | Done | P1 |
| UC-38 | Delete Product from Wishlist | **Actor:** Buyer. Gỡ SP khỏi wishlist. **Business:** Quản lý danh sách quan tâm. | Done | P1 |
| UC-39 | View Purchased Orders | **Actor:** Buyer. List đơn theo status + thời gian. **Business:** Theo dõi mua hàng. | Done | P0 |
| UC-40 | View Order Details | **Actor:** Buyer. Chi tiết dòng hàng, thanh toán, tracking. **Business:** Minh bạch fulfillment. | Done | P0 |
| UC-41 | Cancel Order | **Actor:** Buyer. Chỉ khi status cho phép (PendingPayment/Paid sớm); release stock. **Business:** Giảm đơn ảo / đổi ý. | Done | P0 |
| UC-42 | Confirm Received | **Actor:** Buyer. Delivered → Completed; trigger credit wallet seller (policy). **Business:** Đóng vòng đời đơn & đối soát. | Done | P0 |
| UC-43 | Request Return / Refund | **Actor:** Buyer. Yêu cầu **Trả hàng + Hoàn tiền** (không Đổi hàng — BR-R01). Lý do + bắt buộc video **Unboxing** (6 mặt kiện + mã vận đơn) và **Testing** (bật máy / chứng minh lỗi). Tạo ReturnRequest Pending + ReturnEvidences. **Business:** Bảo vệ buyer; MVP Admin xử lý thủ công. | Done | P1 |
| UC-44 | View Notifications | **Actor:** Buyer/Seller. Inbox thông báo (order, payment, chat, **product moderation**, return, **low-stock**…); SignalR push. **Business:** Giữ user engagement realtime. | Done | P1 |
| UC-45 | Delete Notification | **Actor:** Buyer/Seller. Xóa / ẩn thông báo. **Business:** Dọn inbox. | Done | P2 |
| UC-46 | View Order List | **Actor:** Seller. Đơn của shop; lọc status. **Business:** Vận hành fulfillment. | Done | P0 |
| UC-47 | Update Order Status | **Actor:** Seller. Paid→Confirmed→Shipping→Delivered; nhập tracking thủ công. **Business:** Cập nhật tiến độ giao (không API GHN). | Done | P0 |
| UC-48 | View Return Requests | **Actor:** Admin. Queue return/refund toàn hệ thống. **Business:** Điều phối hoàn hàng (không exchange). | Done | P1 |
| UC-49 | View Return Request Details | **Actor:** Admin. Chi tiết lý do, **video Unboxing/Testing**, order lines. **Business:** Ra quyết định Approve/Reject dựa bằng chứng. | Done | P1 |
| UC-50 | Approve / Reject Return Request | **Actor:** Admin. Duyệt hoặc từ chối + note bắt buộc khi reject (BR-R03). Approve → pipeline Receiving→Refund. **Business:** Kiểm soát gian lận / policy. | Done | P1 |
| UC-52 | Update Return Request Status | **Actor:** Admin. Receiving → Refunded → Closed; hoàn tiền buyer trước rồi `RefundDebit` wallet seller (BR-R04); ghi history. **Business:** Theo dõi pipeline hoàn. | Done | P1 |
| UC-53 | View Recommended Products | **Actor:** Buyer. SP gợi ý từ hành vi / hybrid strategy. **Business:** Tăng AOV & discovery. | Done | P2 |
| UC-54 | View Similar Products | **Actor:** Buyer. SP tương tự theo category/specs/content. **Business:** Cross-sell trên trang detail. | Done | P2 |
| UC-56 | Use AI Shopping Assistant | **Actor:** Buyer. Chatbot Ollama tư vấn SP / FAQ mua sắm. **Business:** Hỗ trợ 24/7, giảm tải CSKH. | Done | P2 |
| UC-57 | View Chat List | **Actor:** Buyer/Seller. Danh sách thread buyer↔shop. **Business:** Kênh thương lượng / hỗ trợ trước-sau bán. | Done | P1 |
| UC-58 | Send Message | **Actor:** Buyer/Seller. Gửi tin nhắn realtime SignalR; optional attachment. **Business:** Tăng trust & chốt sale. | Done | P1 |
| UC-59 | View Product Reviews | **Actor:** Guest/Buyer. List review + rating; có thể hiện sentiment AI. **Business:** Social proof. | Done | P1 |
| UC-60 | Add Product Review | **Actor:** Buyer. Chỉ sau mua hoàn tất; 1–5 sao + nội dung. **Business:** Feedback chất lượng SP. | Done | P1 |
| UC-61 | Update Product Review | **Actor:** Buyer (owner). Sửa review trong cửa sổ cho phép. **Business:** Cho phép chỉnh sau trải nghiệm. | Done | P2 |
| UC-62a | Delete Product Review | **Actor:** Buyer (owner). Xóa / ẩn review của mình. **Business:** Quyền kiểm soát nội dung cá nhân. | Done | P2 |
| UC-62b | Get Seller Detail | **Actor:** Buyer. Trang shop: mô tả, rating, SP, policy. **Business:** Đánh giá độ tin cậy seller. | Done | P0 |
| UC-63 | Rate Seller | **Actor:** Buyer. Chấm điểm shop sau đơn hoàn tất. **Business:** Uy tín seller trên sàn. | Done | P1 |
| UC-64 | View Seller Rating | **Actor:** Guest/Buyer. Xem điểm TB + số lượt. **Business:** Tín hiệu tin cậy công khai. | Done | P1 |
| UC-65 | Follow Seller | **Actor:** Buyer. Follow shop để nhận update. **Business:** Retention & loyalty. | Done | P2 |
| UC-66 | Unfollow Seller | **Actor:** Buyer. Bỏ follow. **Business:** Quản lý sở thích. | Done | P2 |
| UC-67 | View List Follow | **Actor:** Buyer. Danh sách shop đang follow. **Business:** Quay lại shop yêu thích. | Done | P2 |
| UC-69 | View Seller Dashboard | **Actor:** Seller. KPI: đơn, doanh thu, tồn thấp, pending. **Business:** Điều hành cửa hàng nhanh. | Done | P1 |
| UC-70 | View Sales Reports | **Actor:** Seller. Báo cáo theo ngày/tuần/tháng; kèm **margin** từ lot cost vs giá bán (BR-C06). **Business:** Ra quyết định nhập/giá. | Done | P1 |
| UC-71 | View Customer Insights | **Actor:** Admin. Thống kê hành vi / top SP / cohort đơn giản. **Business:** Quản trị sàn. | Done | P2 |
| UC-72 | View Account List | **Actor:** Admin. List user + role + status. **Business:** Quản trị tài khoản. | Done | P1 |
| UC-73 | Lock User Account | **Actor:** Admin. Status → Locked. **Business:** Xử lý vi phạm / gian lận. | Done | P1 |
| UC-74 | Unlock User Account | **Actor:** Admin. Mở khóa tài khoản. **Business:** Khôi phục sau xử lý. | Done | P1 |
| UC-75 | View Seller Registration Requests | **Actor:** Admin. Queue Pending đăng ký seller. **Business:** Kiểm soát ai được bán. | Done | P0 |
| UC-76 | Approve / Reject Seller Registration | **Actor:** Admin. Approve → gán role Seller + tạo Shop + Wallet; Reject + note. **Business:** Onboarding seller an toàn. | Done | P0 |
| UC-78 | Create Voucher in System | **Actor:** Admin. Tạo voucher Scope=System. **Business:** Campaign toàn sàn. | Done | P1 |
| UC-79 | Update Voucher in System | **Actor:** Admin. Sửa điều kiện / thời hạn. **Business:** Điều chỉnh campaign. | Done | P2 |
| UC-80 | Delete Voucher in System | **Actor:** Admin. Xóa / vô hiệu voucher chưa dùng nhiều. **Business:** Dọn KM hết hạn. | Done | P2 |
| UC-81 | Activate / Disable Voucher | **Actor:** Admin. Bật/tắt voucher. **Business:** Kiểm soát hiển thị KM. | Done | P1 |
| UC-85 | View Wallet | **Actor:** Seller. Số dư Available/Pending + lịch sử giao dịch. **Business:** Minh bạch tiền về shop. | Done | P1 |
| UC-87 | Create Voucher for My Shop | **Actor:** Seller. Voucher Scope=Shop gắn ShopId. **Business:** KM riêng cửa hàng. | Done | P1 |
| UC-88 | Update Voucher for My Shop | **Actor:** Seller. Sửa voucher của mình. **Business:** Linh hoạt chiến dịch shop. | Done | P2 |
| UC-89 | Delete Voucher for My Shop | **Actor:** Seller. Xóa voucher shop. **Business:** Kết thúc KM. | Done | P2 |
| UC-90 | AI NL → Filter | **Actor:** Guest/Buyer. Câu tự nhiên → JSON filter hợp lệ → apply search. **Business:** Tìm SP dễ hơn với người không rành filter. | Done | P2 |
| UC-91 | Import Stock Lot | **Actor:** Seller. Nhập lô: LotCode unique, qty > 0, UnitCost ≥ 0, supplier/invoice/date; tăng tồn; cập nhật Avg/LastCost; **không** sửa UnitCost lô cũ (BR-I01, BR-C02). **Business:** Theo dõi giá vốn & lãi gộp đúng khi giá nhập thay đổi. | Done | P0 |
| UC-92 | Update Selling Price | **Actor:** Seller. Đổi BasePrice/SalePrice; ghi ProductPriceHistories; độc lập giá vốn lô. **Business:** Phản ứng thị trường mà không phá lịch sử cost/đơn. | Done | P0 |

---

## Thống kê nhanh

| Priority | Số lượng (xấp xỉ) | Ý nghĩa |
|----------|-------------------|---------|
| P0 | ~35 | Phải có để demo end-to-end mua bán |
| P1 | ~30 | Hoàn thiện vận hành sàn |
| P2 | ~15 | AI / social / polish |
| P3 | 0 (hiện tại) | Dự phòng |

**ID trống (reserved / out of scope MVP):** UC-51, UC-55, UC-68, UC-77, UC-82–84, UC-86.

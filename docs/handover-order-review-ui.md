# Handover - Order review UI (My Orders)

## Phạm vi

Form **đánh giá seller + review sản phẩm** trên trang chi tiết đơn (`/account/orders/:orderId`), chỉ hiện khi đơn **Completed** và chưa có return request.

## Chạy nhanh

```bash
# Terminal 1 - BE (Development)
cd aidr-be/AIDR.Api && dotnet run

# Terminal 2 - FE
cd aidr-fe && npm run dev
```

Seed tối thiểu (Postman / curl, chỉ khi `IsDevelopment()`):

```http
POST http://localhost:5xxx/api/dev/seed-demo-accounts
POST http://localhost:5xxx/api/dev/seed-catalog
POST http://localhost:5xxx/api/dev/seed-returns
```

> Port BE: xem `launchSettings.json` hoặc log khi `dotnet run`.

## Tài khoản demo

| Email | Password | Role |
|-------|----------|------|
| `buyer@aidr.local` | `Aidr@123` | Buyer |

## Test UI review

1. Đăng nhập buyer → **Account → My orders**.
2. Mở đơn có trạng thái **Completed** (nếu chỉ có **Delivered**: bấm **Confirm received** trước).
3. Cuộn cột trái (cùng khu Items / Shipping) - card **Reviews & ratings**:
   - **Bước 1:** rating seller (1–5 sao, comment tùy chọn).
   - **Bước 2:** review từng dòng sản phẩm (rating bắt buộc + nội dung review).
4. Sau submit: banner xanh + progress `x/y items` trên tiêu đề card.
5. Review sản phẩm xuất hiện trên PDP; rating seller trên trang shop.

## API liên quan

| Method | Endpoint | Ghi chú |
|--------|----------|---------|
| `POST` | `/api/products/{productId}/reviews` | Body: `orderId`, `rating`, `title?`, `content` |
| `POST` | `/api/seller-ratings` | Body: `shopId`, `orderId`, `score`, `comment?` |

Điều kiện BE: đơn thuộc buyer, **Completed**, chưa review/rate trùng `(user, order)`.

## File chính (FE)

| File | Vai trò |
|------|---------|
| `aidr-fe/src/views/account/OrderDetailPage.tsx` | Gắn section vào cột main |
| `aidr-fe/src/components/reviews/OrderReviewSection.tsx` | UI 2 bước + form |
| `aidr-fe/src/components/reviews/StarRatingInput.tsx` | Input sao |
| `aidr-fe/src/styles/account.css` | Style `.order-review*` (khớp `account-card` / `order-line`) |

## Ghi chú

- UI dùng token account (`account-card`, `order-line`, `account-btn`), không dùng `btn-default` catalog.
- Không hiện review khi đơn đang có return request (tránh xung đột luồng hoàn tiền).
- Seed PDP reviews (khác order review): `POST /api/dev/seed-product-reviews`.

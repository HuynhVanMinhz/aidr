# AIDR — Solution: Tự động hoá vòng đời đơn hàng qua GHN (Paid → Confirmed → Shipping → Delivered → Completed)

**Status:** Implemented — schema + backend + FE đã ship; xem §12
**Module:** Shipping (mới) + Order + SellerCenter
**Liên quan:** `docs/solution-escrow-settlement.md` (Completed → settlement), UC-35 (payOS webhook), `docs/architecture-aidr-be.md`
**Phạm vi:** trạng thái đơn do **GHN thật** đẩy về; seller **vẫn** cập nhật thủ công được bất cứ lúc nào.

---

## 1. Yêu cầu

> Paid → Confirmed → Shipping → Delivered → Completed tự chạy bằng API GHN thật (không mock),
> nhưng seller vẫn có thể tự cập nhật trạng thái.

Nguyên tắc thiết kế:

1. **Trạng thái đơn là ánh xạ của trạng thái vận đơn.** Nguồn sự thật cho Shipping/Delivered là GHN.
2. **Không có dữ liệu giả.** Mọi dòng `Shipments` đều sinh ra từ một lệnh tạo vận đơn GHN thật; không có provider mô phỏng nào trong hệ thống.
3. **Hai đường cùng đi tới, không đánh nhau.** Job và seller dùng chung luật chuyển bậc **chỉ tiến**: ai tới trước thì thắng, bên tới sau thành no-op.
4. **Webhook là đường chính, poll là lưới an toàn.** Webhook có thể mất; job vẫn kéo được đơn về đúng trạng thái.
5. **Idempotent tuyệt đối.** Webhook lặp / job trùng / retry không được đẩy trạng thái hai lần hay ghi hai dòng history.
6. **Không bao giờ để đơn kẹt.** Tạo vận đơn lỗi → retry có giới hạn → hiện lỗi GHN nguyên văn cho seller và seller tự đẩy trạng thái.
7. **Provider-agnostic.** GHN hôm nay, GHTK/Viettel Post ngày mai — chỉ thêm một adapter, không đụng vào Order.

---

## 2. Hiện trạng và khoảng trống

| Đang có | Vấn đề |
|---|---|
| payOS webhook → `Orders.Status = Paid` | Dừng ở đây; các bước sau 100% thủ công |
| `SellerOrderRepository.UpdateStatusAsync` + `OrderConstants.SellerStatusTransitions` | Seller phải bấm 3 lần / đơn; tracking là chuỗi tự gõ, không phải mã vận đơn thật |
| `SettlementBackgroundService` + `AutoCompleteDeliveredOrderAsync` | **Delivered → Completed đã tự động rồi** (sau `Settlement:AutoCompleteDays`) — chỉ còn 3 bước đầu |
| — | Không có bảng vận đơn, không có tích hợp hãng vận chuyển, không có webhook vận chuyển |

Nghĩa là: chỉ cần tự động hoá **Paid → Confirmed → Shipping → Delivered**; mắt xích cuối đã có sẵn.

---

## 3. Kiến trúc

```
                       payOS webhook
     PendingPayment ───────────────────► Paid
                                          │
             ShippingBackgroundService     │ ① sau ConfirmDelayMinutes
             (mỗi JobIntervalMinutes)      │   POST /shiip/public-api/v2/shipping-order/create
                                          ▼
                                   Shipments(Created) ──► Order = Confirmed
                                          │                (TrackingCode = order_code của GHN)
                     ┌────────────────────┴────────────────────┐
                     │ webhook GHN (đường chính)               │ job poll (lưới an toàn)
                     ▼                                         ▼
             POST /api/webhooks/shipping/GHN         .../shipping-order/detail
                     └────────────────────┬────────────────────┘
                                          ▼
                            ShipmentEvents (append-only, idempotent)
                                          │  ② map trạng thái
                        PickedUp/InTransit ├──► Order = Shipping     ◄── seller cũng đẩy được
                              Delivered    ├──► Order = Delivered        bằng tay (§9)
                       Failed/Returned     └──► giữ nguyên + báo seller
                                          │
                                          ▼ ③ SettlementBackgroundService (đã có)
                                      Completed → SettlementEntry(Holding)
```

Ba lớp:

- `IShippingProvider` — adapter hãng vận chuyển. Hiện chỉ có `GhnShippingProvider` (create / detail / cancel / parse webhook).
- `IShipmentRepository` — bảng `Shipments` / `ShipmentEvents` và **điểm duy nhất** được phép đẩy trạng thái đơn tự động.
- `IShippingService` — orchestration: dispatch, webhook, poll.

---

## 4. Ánh xạ trạng thái

| Shipment status (nội bộ) | GHN status | Order status |
|---|---|---|
| `Created` | `ready_to_pick`, `picking`, `money_collect_picking` | `Confirmed` |
| `PickedUp` | `picked`, `storing`, `transporting`, `sorting` | `Shipping` |
| `InTransit` | `delivering`, `money_collect_delivering` | `Shipping` |
| `Delivered` | `delivered` | `Delivered` |
| `Failed` | `delivery_fail`, `waiting_to_return`, `exception`, `damage`, `lost` | giữ nguyên, báo seller |
| `Returned` | `return*`, `returned`, `return_fail` | giữ nguyên, chờ return flow |
| `Cancelled` | `cancel` | giữ nguyên |

Quy tắc áp dụng: chỉ đẩy **tiến** theo `OrderConstants.SellerStatusTransitions` (Paid→Confirmed→Shipping→Delivered). Event đến trễ / trùng / lùi bậc vẫn được ghi vào `ShipmentEvents` nhưng **không** đổi `Orders.Status`. Status lạ (GHN thêm mới) được log cảnh báo và coi như `Created` — không bao giờ tự nhảy bậc.

---

## 5. Schema — `scripts/shipping-schema.sql`

### 5.1 `Shipments` — một dòng cho một đơn

| Cột | Ghi chú |
|---|---|
| `ShipmentId` | PK |
| `OrderId` | **UNIQUE** — một đơn một vận đơn |
| `Provider` | `GHN` (snapshot, để sau này thêm hãng khác) |
| `ProviderShipmentId` | `order_code` GHN trả về; có index để tra webhook |
| `TrackingCode` | mã hiển thị cho buyer (bằng `order_code`) |
| `Status` | `Pending` \| `Created` \| `PickedUp` \| `InTransit` \| `Delivered` \| `Failed` \| `Returned` \| `Cancelled` |
| `ProviderStatus` | chuỗi gốc của GHN, để debug |
| `ShippingFeeQuoted`, `ExpectedDeliveryAt` | `total_fee` / `expected_delivery_time` GHN trả về |
| `NextActionAt` | mốc poll kế tiếp |
| `AttemptCount`, `LastError` | retry tạo vận đơn; `LastError` là **message nguyên văn của GHN** |
| `RawCreateJson` | payload gốc |

`Status = Pending` nghĩa là **chưa** có vận đơn: đó là dấu vết của lần tạo thất bại, không phải vận đơn giả.

### 5.2 `ShipmentEvents` — append-only

`ShipmentEventId`, `ShipmentId`, `ExternalEventId` (idempotency key), `ProviderStatus`, `MappedStatus`, `Description`, `Source` (`Webhook` \| `Poll` \| `Dispatch` \| `Manual`), `OccurredAt`, `ReceivedAt`, `RawJson`.

`UNIQUE (ShipmentId, ExternalEventId)` — webhook lặp bị chặn ở tầng DB, không phụ thuộc code.

---

## 6. Cấu hình — `appsettings.json`

```jsonc
"Shipping": {
  "Provider": "GHN",
  "EnableAutoFulfillment": true,   // false = không ai đặt vận đơn, seller làm tay hoàn toàn
  "EnableBackgroundJob": true,
  "JobIntervalMinutes": 5,
  "ConfirmDelayMinutes": 5,        // Paid ở lại bao lâu trước khi tạo vận đơn (khoảng đệm xử lý sự cố)
  "MaxDispatchAttempts": 3,
  "PollIntervalMinutes": 15,
  "BatchSize": 50,
  "Ghn": {
    "BaseUrl": "https://dev-online-gateway.ghn.vn",  // production: https://online-gateway.ghn.vn
    "Token": "",          // BẮT BUỘC — token API GHN
    "ShopId": 0,          // BẮT BUỘC — ShopId GHN (địa chỉ lấy hàng)
    "WebhookToken": "",   // secret tự đặt, gửi kèm URL webhook; để trống = không kiểm tra
    "ServiceTypeId": 2,   // 2 = hàng nhẹ / chuẩn
    "PaymentTypeId": 1,   // 1 = shop trả phí ship
    "DefaultWeightGram": 500,
    "RequiredNote": "KHONGCHOXEMHANG",
    "TimeoutSeconds": 30
  }
}
```

**Lấy credential:** đăng ký tại <https://khachhang.ghn.vn> (production) hoặc <https://5sao.ghn.dev> (sandbox) → *Cấu hình → API* để lấy `Token`; `ShopId` là id cửa hàng / địa chỉ lấy hàng trong danh sách shop. Không commit token thật lên repo public — dùng `dotnet user-secrets` hoặc biến môi trường `Shipping__Ghn__Token`.

**Chưa điền token thì sao:** API vẫn boot bình thường, job log `WARN "Shipping sweep is idle: GHN has no credentials"` rồi dừng, và seller cập nhật trạng thái thủ công như trước. Không có nhánh mock nào chạy thay.

---

## 7. Background job — `ShippingBackgroundService`

Mỗi tick chạy hai bước, độc lập nhau, lỗi bước này không chặn bước kia:

1. **Dispatch** — `Orders.Status` là `Paid` **hoặc** `Confirmed`, `PaidAt <= now - ConfirmDelayMinutes`, chưa có shipment (hoặc shipment `Pending` còn lượt retry) → gọi GHN create → ghi `Shipments` → `Order = Confirmed` + `TrackingCode` + `OrderStatusHistory(ChangedBy = null)` → notify buyer. Lỗi → `AttemptCount++`, `LastError`, backoff `5 × AttemptCount` phút (tối đa 60).

   `Confirmed` nằm trong điều kiện vì seller có thể bấm *Mark as Confirmed* trước khi sweep kịp chạy; nếu chỉ nhận `Paid` thì đơn đó **mất tự động hoá vĩnh viễn** và seller bị buộc tự nhập mã vận đơn. Với đơn đã `Confirmed` sẵn, booking chỉ ghi thêm `TrackingCode` — status không đổi, nên không notify lần hai.

   Địa chỉ lấy hàng đi kèm mỗi lần create (`from_name` / `from_phone` / `from_address` / `from_ward_name` / `from_district_name` / `from_province_name`) lấy từ chính `Shops`. Không gửi thì GHN tự suy ra từ shop gắn với token — shop sandbox không có địa chỉ nên trả `FROM_ADDRESS_CONVERT_FAIL`. Shop thiếu địa chỉ/SĐT bị chặn ngay trong `ShippingService` với thông báo chỉ rõ phải bổ sung trong Shop settings, thay vì để GHN trả lỗi khó hiểu.
2. **Poll** — shipment đang chạy và tới hạn `NextActionAt` → GHN detail → apply event nếu trạng thái đổi.

Cùng giả định single-instance như `SettlementBackgroundService`; scale-out cần app lock.

---

## 8. API

| Method | Route | Ai gọi |
|---|---|---|
| `POST` | `/api/webhooks/shipping/GHN` | GHN (anonymous + `WebhookToken` qua header `X-Shipping-Token` hoặc `?token=`) |
| `GET` | `/api/seller/orders/{id}` | Seller — đã kèm khối `fulfillment` (vận đơn + timeline event) |
| `POST` | `/api/seller/orders/{id}/status` | Seller — cập nhật thủ công, **luôn dùng được** (§9) |
| `POST` | `/api/dev/shipping/sweep` | Dev — chạy ngay một lượt sweep thay vì chờ timer |
| `POST` | `/api/dev/seed-shipping` | Dev — apply schema + seed đơn Paid chờ đặt vận đơn |

**Đăng ký webhook với GHN:** trong dashboard GHN mục *Cấu hình → Webhook*, trỏ về
`https://<domain>/api/webhooks/shipping/GHN?token=<WebhookToken>`. Local cần public URL
(ngrok) giống hệt cách làm webhook payOS.

### 8.1 Kịch bản test

```bash
# 1. schema + đơn demo (2 đơn Paid: một địa chỉ GHN nhận, một địa chỉ GHN từ chối)
curl -X POST http://localhost:5080/api/dev/seed-shipping
# 2. chạy sweep ngay
curl -X POST http://localhost:5080/api/dev/shipping/sweep
```

Kỳ vọng: `SHIP-GHN-OK` → `Confirmed`, `Shipments.ProviderShipmentId` là mã vận đơn GHN thật
(tra được trên dashboard GHN); `SHIP-GHN-FAIL` giữ `Paid`, `Shipments.Status = Pending` với
`LastError` là message lỗi nguyên văn của GHN. Các bậc sau đến từ webhook GHN hoặc lượt poll.

Muốn xem tiếp `Delivered → Completed` ngay trong buổi demo thì đặt
`Settlement:AutoCompleteDays: 0` — sweep đối soát sẽ đóng đơn ở lượt kế.

---

## 9. Seller vẫn cập nhật thủ công được

Nút `Mark as Confirmed / Shipping / Delivered` **không bị khoá**. `CanUpdateStatus` chỉ phụ thuộc
`Orders.Status` như trước; automation chạy song song.

| Tình huống | Chuyện gì xảy ra |
|---|---|
| Seller bấm trước, GHN báo sau | Event GHN vẫn được ghi vào `ShipmentEvents`, nhưng không đổi status (đơn đã ở bậc đó hoặc cao hơn) |
| GHN báo trước, seller bấm sau | Repository trả 409 `Invalid status transition` — đúng, vì bậc đó đã đi qua |
| GHN từ chối tạo vận đơn | Card Fulfillment hiện banner vàng + lỗi GHN; seller tự đẩy trạng thái, tự nhập tracking |
| `EnableAutoFulfillment = false` | Không ai đặt vận đơn; quay về quy trình thủ công 100% |

Phân biệt người/máy: thao tác seller ghi `OrderStatusHistory.ChangedBy = sellerUserId`,
automation ghi `ChangedBy = null`.

---

## 10. Idempotency và các bẫy

| Bẫy | Cách chặn |
|---|---|
| Webhook GHN gửi lặp | `UNIQUE (ShipmentId, ExternalEventId)`; trùng → trả `200` + `IdempotentReplay = true` |
| Job trùng lượt tạo vận đơn | `UNIQUE (OrderId)` trên `Shipments` + transaction |
| Event đến ngược thứ tự | Chỉ apply khi là bước **tiến** theo bảng §4 |
| Seller và job cùng đẩy một đơn | Cả hai đi qua cùng bảng chuyển bậc; bên tới sau nhận no-op / 409 |
| Đơn đổi trạng thái khi đang gọi GHN | `SaveDispatchAsync` đọc lại status trong transaction; khác `Paid` → huỷ ghi nhận |
| GHN không resolve được phường/quận | Lỗi ghi vào `LastError` (nguyên văn) → hiện trên UI seller |
| Webhook giả mạo | `WebhookToken` bắt buộc khi đã cấu hình; sai token → 403 |
| Token GHN thiếu | Job không chạy và **nói rõ** trong log; không có nhánh giả lập chạy thay |

---

## 11. Frontend

- `SellerOrderDetailPage`: card **Fulfillment** — hãng vận chuyển, mã vận đơn GHN, trạng thái, thời gian dự kiến, timeline event; banner vàng khi GHN từ chối. Form cập nhật thủ công **luôn hiển thị** khi đơn còn bậc kế.
- `SellerOrderListPage`: cột trạng thái có thêm dòng phụ trạng thái vận đơn + nhãn `auto`.
- Buyer: `TrackingCode` giờ là mã GHN thật; không đổi API.

---

## 12. Trạng thái triển khai

### Đã làm
- `scripts/shipping-schema.sql` — `Shipments`, `ShipmentEvents` (idempotent, chạy lại được).
- Module `AIDR.Modules/Shipping` — options, abstractions, `ShippingService` (dispatch + webhook + poll).
- `AIDR.Infrastructure/Shipping` — `ShipmentRepository`, `GhnShippingProvider`.
- `ShippingBackgroundService` + `ShippingWebhooksController` + dev endpoints (`seed-shipping`, `shipping/sweep`).
- `SellerOrderRepository` — DTO có khối `Fulfillment`; quyền cập nhật thủ công giữ nguyên như trước.
- FE: card Fulfillment + timeline, form thủ công luôn dùng được.

### Còn lại
- Điền `Shipping:Ghn:Token` + `ShopId` thật rồi chạy end-to-end (code đã sẵn, chưa có tài khoản để verify).
- Đăng ký URL webhook trong dashboard GHN (cần public HTTPS).
- Địa chỉ buyer đang là text tự do; GHN match theo tên tỉnh/quận/phường nên đơn có địa chỉ gõ sai sẽ rơi vào nhánh lỗi. Muốn chắc hơn thì cho buyer chọn địa chỉ từ master data GHN (`/master-data/province|district|ward`).
- App lock nếu API scale-out nhiều instance.

---

## 13. Bản đồ theo dõi đơn hàng (buyer + seller)

**Status:** Implemented.

### 13.1 Vấn đề

Buyer và seller không nhìn thấy đơn hàng "ở đâu". GHN **không** phát vị trí GPS
của shipper — API chỉ trả một chuỗi trạng thái (`ready_to_pick`, `delivering`,
`delivered`…). Nên bản đồ ở đây là **tuyến giao hàng**, không phải toạ độ thật của
tài xế; UI nói rõ điều đó ngay dưới map thay vì để người dùng hiểu nhầm.

### 13.2 Toạ độ đến từ đâu

| Đầu tuyến | Nguồn | Ai ghim |
|---|---|---|
| Điểm lấy hàng | `Shops.Latitude/Longitude` | seller, trong *Shop settings* |
| Điểm giao hàng | `Addresses.Latitude/Longitude` → snapshot vào `Orders.ShippingSnapshotJson` | buyer, khi lưu địa chỉ |

Pin của buyer trước đây bị **vứt đi** khi submit form địa chỉ — giờ nó được lưu.
Toạ độ giao hàng được **snapshot cùng địa chỉ** lúc đặt đơn: sửa sổ địa chỉ sau
này không được phép dời điểm giao của một đơn đã xong.

Schema: `scripts/address-geo-schema.sql` (idempotent, thêm 2 cột NULL vào
`Addresses` và `Shops`). Chạy bằng `POST /api/dev/address-geo-schema`, hoặc kèm
theo `POST /api/dev/seed-shipping`. Đơn cũ không có pin thì map hiện thông báo
"chưa có toạ độ" chứ không vỡ.

### 13.3 API

| Endpoint | Khối mới |
|---|---|
| `GET /api/orders/{id}` (buyer) | `tracking`: carrier, trackingCode, shipmentStatus, expected/lastUpdate, `route`, `events` |
| `GET /api/seller/orders/{id}` | `fulfillment.route` |

`route` = `{ pickup, pickupLabel, destination, destinationLabel }`, mỗi đầu là
`{ lat, lng }` hoặc `null`. `BuildRoute` bỏ qua `(0,0)` — đó là dấu vết của một
dòng ghi dở, không phải một cái pin.

Buyer **không** nhận `attemptCount` / `lastError`: lỗi hãng vận chuyển là việc
seller phải xử lý, không phải thứ buyer đọc.

### 13.4 Vị trí gói hàng trên map

`routeProgress()` (`aidr-fe/src/types/tracking.ts`) ánh xạ trạng thái vận đơn →
một điểm 0..1 trên tuyến: `Created` 0.06, `PickedUp` 0.3, `InTransit` 0.68,
`Delivered` 1. Đơn chưa có vận đơn thì rơi về trạng thái đơn. Đây là **vị trí
trên một bức tranh**, không phải một phép đo.

Tuyến vẽ bằng đường cong bậc hai (không phải đường thẳng — đường thẳng mời người
đọc đi đo nó); phần đã đi vẽ liền, phần còn lại vẽ đứt.

### 13.5 Tile và geocoding

`tile.openstreetmap.org` và `nominatim.openstreetmap.org` **không resolve được
từ nhiều mạng ở Việt Nam** — request treo, Leaflet vẽ ô xám, và mọi lần geocode
im lặng thất bại. Đó là lý do map trong form địa chỉ trắng trơn.

- Tile: CARTO (`basemaps.cartocdn.com`, cùng dữ liệu OSM), tự động lùi sang
  `tile.openstreetmap.de` rồi ArcGIS nếu nguồn đầu không tải nổi tile nào.
  Theo `data-theme` sáng/tối. Xem `aidr-fe/src/utils/mapTiles.ts`.
- Geocoding: Photon (`photon.komoot.io`), key-less như Nominatim.

### 13.6 UI

- Buyer `OrderDetailPage`: card **Delivery tracking** — map, trạng thái vận đơn,
  mã vận đơn, dự kiến giao, timeline event của hãng.
- Seller `SellerOrderDetailPage`: card **Delivery route** trong cột chính.
- Seller `SellerShopSettingsPage`: map picker để ghim điểm lấy hàng.
- Buyer `AddressesPage`: pin đã ghim giờ được lưu và nạp lại khi sửa địa chỉ.

### 13.7 Còn lại

- Chưa có tuyến đường thật (routing engine). Nếu cần, thêm một provider chỉ
  đường và thay đường cong bằng polyline thật.

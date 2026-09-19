/*
  AIDR - Automatic fulfillment demo seed (GHN-driven order pipeline).

  Prerequisites: demo accounts + catalog (Approved product on the demo shop),
  and scripts/shipping-schema.sql applied (the dev endpoint runs it first).
  Idempotent by fixed OrderCode / OrderId.

  No fake shipments are inserted - every Shipments row in this system comes from
  a real GHN booking. What this seeds is the *input* to that booking:

  - SHIP-GHN-OK   : Paid, GHN-canonical address    -> sweep books it, order goes Confirmed
  - SHIP-GHN-FAIL : Paid, ward GHN cannot resolve  -> booking fails 3x, seller updates by hand

  After POST /api/dev/shipping/sweep, check dbo.Shipments: the first order gets a
  real GHN order code, the second gets Status='Pending' with GHN's own error text
  in LastError.
*/

SET NOCOUNT ON;

DECLARE
    @BuyerId   UNIQUEIDENTIFIER = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC',
    @ShopId    UNIQUEIDENTIFIER = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD',
    @AddressId UNIQUEIDENTIFIER = 'A1111111-1111-1111-1111-111111111101',
    @ProductId UNIQUEIDENTIFIER,
    @ProductName NVARCHAR(256),
    @UnitPrice DECIMAL(18,2),
    /* GHN matches province / district / ward by name, so these must be the
       canonical Vietnamese names from its master data. */
    @GoodJson NVARCHAR(MAX) = N'{"receiverName":"Jamie Buyer","phone":"0900000003","province":"Hà Nội","district":"Quận Cầu Giấy","ward":"Phường Dịch Vọng","streetAddress":"88 Xuân Thủy"}',
    @BadJson  NVARCHAR(MAX) = N'{"receiverName":"Jamie Buyer","phone":"0900000003","province":"Hà Nội","district":"Quận Cầu Giấy","ward":"Phường Không Tồn Tại","streetAddress":"88 Xuân Thủy"}',
    @Now DATETIME2(3) = SYSUTCDATETIME(),
    /* Orders */
    @OOk   UNIQUEIDENTIFIER = 'C1000001-0001-4000-8000-000000000001',
    @OFail UNIQUEIDENTIFIER = 'C1000001-0001-4000-8000-000000000004',
    /* Order items */
    @OiOk   UNIQUEIDENTIFIER = 'C2000001-0001-4000-8000-000000000001',
    @OiFail UNIQUEIDENTIFIER = 'C2000001-0001-4000-8000-000000000004',
    @LineTotal DECIMAL(18,2),
    @ShipFee   DECIMAL(18,2) = 30000,
    @Total     DECIMAL(18,2);

IF OBJECT_ID('dbo.Shipments', 'U') IS NULL
BEGIN
    RAISERROR(N'dbo.Shipments missing. Run scripts/shipping-schema.sql first.', 16, 1);
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @BuyerId)
BEGIN
    RAISERROR(N'Demo buyer missing. Run POST /api/dev/seed-demo-accounts first.', 16, 1);
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Shops WHERE ShopId = @ShopId)
    SELECT TOP (1) @ShopId = ShopId FROM dbo.Shops WHERE Status = N'Active' ORDER BY CreatedAt;

IF @ShopId IS NULL
BEGIN
    RAISERROR(N'Demo shop missing. Run seed-demo-accounts / seed-catalog first.', 16, 1);
    RETURN;
END;

SELECT TOP (1)
    @ProductId = ProductId,
    @ProductName = Name,
    @UnitPrice = COALESCE(NULLIF(SalePrice, 0), BasePrice)
FROM dbo.Products
WHERE ShopId = @ShopId
  AND Status = N'Approved'
ORDER BY CreatedAt;

IF @ProductId IS NULL
BEGIN
    RAISERROR(N'No Approved product. Run POST /api/dev/seed-catalog first.', 16, 1);
    RETURN;
END;

SET @LineTotal = @UnitPrice;
SET @Total = @LineTotal + @ShipFee;

IF NOT EXISTS (SELECT 1 FROM dbo.Addresses WHERE AddressId = @AddressId)
BEGIN
    INSERT INTO dbo.Addresses (
        AddressId, UserId, ReceiverName, Phone, Province, District, Ward, StreetAddress, IsDefault, CreatedAt, UpdatedAt
    )
    VALUES (
        @AddressId, @BuyerId, N'Jamie Buyer', N'0900000003',
        N'Hà Nội', N'Quận Cầu Giấy', N'Phường Dịch Vọng', N'88 Xuân Thủy', 1, @Now, @Now
    );
END;

/* -------------------------------------------------------------------------- */
/* SHIP-GHN-OK - paid an hour ago, waiting for the sweep to book it with GHN   */
/* -------------------------------------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE OrderId = @OOk)
BEGIN
    INSERT INTO dbo.Orders (
        OrderId, OrderCode, BuyerUserId, ShopId, ShippingAddressId, ShippingSnapshotJson,
        Status, SubtotalAmount, DiscountAmount, ShippingFee, TotalAmount, Currency,
        PaidAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @OOk, N'SHIP-GHN-OK', @BuyerId, @ShopId, @AddressId, @GoodJson,
        N'Paid', @LineTotal, 0, @ShipFee, @Total, 'VND',
        DATEADD(HOUR, -1, @Now), DATEADD(HOUR, -1, @Now), @Now
    );

    INSERT INTO dbo.OrderItems (
        OrderItemId, OrderId, ProductId, ProductNameSnapshot, SkuSnapshot,
        UnitPrice, UnitCostAvg, Quantity, LineTotal
    )
    VALUES (
        @OiOk, @OOk, @ProductId, @ProductName, N'SHIP-SKU',
        @UnitPrice, ROUND(@UnitPrice * 0.72, 0), 1, @LineTotal
    );

    INSERT INTO dbo.Payments (
        PaymentId, OrderId, Provider, ProviderPaymentId, Amount, Currency, Status, PaidAt, CreatedAt, UpdatedAt
    )
    VALUES (
        NEWID(), @OOk, N'payOS', N'ship-ghn-ok-pay', @Total, 'VND', N'Succeeded',
        DATEADD(HOUR, -1, @Now), DATEADD(HOUR, -1, @Now), @Now
    );

    INSERT INTO dbo.OrderStatusHistories (OrderId, FromStatus, ToStatus, ChangedBy, Note, CreatedAt)
    VALUES (@OOk, N'PendingPayment', N'Paid', NULL, N'Payment succeeded via payOS webhook', DATEADD(HOUR, -1, @Now));
END;

/* -------------------------------------------------------------------------- */
/* SHIP-GHN-FAIL - same order, address GHN will reject                         */
/* -------------------------------------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE OrderId = @OFail)
BEGIN
    INSERT INTO dbo.Orders (
        OrderId, OrderCode, BuyerUserId, ShopId, ShippingAddressId, ShippingSnapshotJson,
        Status, SubtotalAmount, DiscountAmount, ShippingFee, TotalAmount, Currency,
        PaidAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @OFail, N'SHIP-GHN-FAIL', @BuyerId, @ShopId, @AddressId, @BadJson,
        N'Paid', @LineTotal, 0, @ShipFee, @Total, 'VND',
        DATEADD(HOUR, -5, @Now), DATEADD(HOUR, -5, @Now), @Now
    );

    INSERT INTO dbo.OrderItems (
        OrderItemId, OrderId, ProductId, ProductNameSnapshot, SkuSnapshot,
        UnitPrice, UnitCostAvg, Quantity, LineTotal
    )
    VALUES (
        @OiFail, @OFail, @ProductId, @ProductName, N'SHIP-SKU',
        @UnitPrice, ROUND(@UnitPrice * 0.72, 0), 1, @LineTotal
    );

    INSERT INTO dbo.Payments (
        PaymentId, OrderId, Provider, ProviderPaymentId, Amount, Currency, Status, PaidAt, CreatedAt, UpdatedAt
    )
    VALUES (
        NEWID(), @OFail, N'payOS', N'ship-ghn-fail-pay', @Total, 'VND', N'Succeeded',
        DATEADD(HOUR, -5, @Now), DATEADD(HOUR, -5, @Now), @Now
    );

    INSERT INTO dbo.OrderStatusHistories (OrderId, FromStatus, ToStatus, ChangedBy, Note, CreatedAt)
    VALUES (@OFail, N'PendingPayment', N'Paid', NULL, N'Payment succeeded via payOS webhook', DATEADD(HOUR, -5, @Now));
END;

PRINT N'seed-shipping.sql completed.';

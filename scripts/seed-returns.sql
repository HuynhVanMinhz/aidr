/*
  AIDR - Return / Refund / Exchange demo seed
  Prerequisites: demo accounts + catalog (Approved product on demo shop).
  Idempotent by fixed OrderCode / ReturnRequestId.

  Scenarios:
  - RET-ELIGIBLE  : Delivered order, no return → buyer can open request
  - RET-PENDING   : Pending return → admin queue approve/reject
  - RET-APPROVED  : Approved (forwarded to seller) → seller confirm
  - RET-RECV      : Receiving (after SellerConfirmed) → seller accept goods
  - RET-REJECTED  : Rejected sample (order back to Delivered)
  - RET-CLOSED    : Refunded then Closed (list filters)
*/

SET NOCOUNT ON;

DECLARE
    @BuyerId   UNIQUEIDENTIFIER = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC',
    @SellerId  UNIQUEIDENTIFIER = 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB',
    @AdminId   UNIQUEIDENTIFIER = 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    @ShopId    UNIQUEIDENTIFIER = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD',
    @AddressId UNIQUEIDENTIFIER = 'A1111111-1111-1111-1111-111111111101',
    @ProductId UNIQUEIDENTIFIER,
    @ProductName NVARCHAR(256),
    @UnitPrice DECIMAL(18,2),
    @ShippingJson NVARCHAR(MAX) = N'{"receiverName":"Jamie Buyer","phone":"0900000003","province":"Hanoi","district":"Cau Giay","ward":"Dich Vong","streetAddress":"88 Xuan Thuy"}',
    @Now DATETIME2(3) = SYSUTCDATETIME(),
    @UnboxUrl NVARCHAR(512) = N'https://res.cloudinary.com/demo/video/upload/v1680000000/aidr-demo-unboxing.mp4',
    @TestUrl  NVARCHAR(512) = N'https://res.cloudinary.com/demo/video/upload/v1680000000/aidr-demo-testing.mp4',
    /* Orders */
    @OEligible UNIQUEIDENTIFIER = 'B1000001-0001-4000-8000-000000000001',
    @OPending  UNIQUEIDENTIFIER = 'B1000001-0001-4000-8000-000000000002',
    @OApproved UNIQUEIDENTIFIER = 'B1000001-0001-4000-8000-000000000003',
    @ORecv     UNIQUEIDENTIFIER = 'B1000001-0001-4000-8000-000000000004',
    @ORejected UNIQUEIDENTIFIER = 'B1000001-0001-4000-8000-000000000005',
    @OClosed   UNIQUEIDENTIFIER = 'B1000001-0001-4000-8000-000000000006',
    /* Order items */
    @OiEligible UNIQUEIDENTIFIER = 'B2000001-0001-4000-8000-000000000001',
    @OiPending  UNIQUEIDENTIFIER = 'B2000001-0001-4000-8000-000000000002',
    @OiApproved UNIQUEIDENTIFIER = 'B2000001-0001-4000-8000-000000000003',
    @OiRecv     UNIQUEIDENTIFIER = 'B2000001-0001-4000-8000-000000000004',
    @OiRejected UNIQUEIDENTIFIER = 'B2000001-0001-4000-8000-000000000005',
    @OiClosed   UNIQUEIDENTIFIER = 'B2000001-0001-4000-8000-000000000006',
    /* Returns */
    @RPending  UNIQUEIDENTIFIER = 'B3000001-0001-4000-8000-000000000002',
    @RApproved UNIQUEIDENTIFIER = 'B3000001-0001-4000-8000-000000000003',
    @RRecv     UNIQUEIDENTIFIER = 'B3000001-0001-4000-8000-000000000004',
    @RRejected UNIQUEIDENTIFIER = 'B3000001-0001-4000-8000-000000000005',
    @RClosed   UNIQUEIDENTIFIER = 'B3000001-0001-4000-8000-000000000006',
    @LineTotal DECIMAL(18,2),
    @ShipFee   DECIMAL(18,2) = 30000,
    @Total     DECIMAL(18,2);

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @BuyerId)
BEGIN
    RAISERROR(N'Demo buyer missing. Run POST /api/dev/seed-demo-accounts first.', 16, 1);
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @AdminId)
BEGIN
    RAISERROR(N'Demo admin missing. Run POST /api/dev/seed-demo-accounts first.', 16, 1);
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

/* Buyer shipping address (optional FK) */
IF NOT EXISTS (SELECT 1 FROM dbo.Addresses WHERE AddressId = @AddressId)
BEGIN
    INSERT INTO dbo.Addresses (
        AddressId, UserId, ReceiverName, Phone, Province, District, Ward, StreetAddress, IsDefault, CreatedAt, UpdatedAt
    )
    VALUES (
        @AddressId, @BuyerId, N'Jamie Buyer', N'0900000003',
        N'Ha Noi', N'Cau Giay', N'Dich Vong', N'88 Xuan Thuy', 1, @Now, @Now
    );
END;

/* Ensure seller wallet has balance for RefundDebit demos */
IF NOT EXISTS (SELECT 1 FROM dbo.Wallets WHERE ShopId = @ShopId)
BEGIN
    INSERT INTO dbo.Wallets (WalletId, ShopId, AvailableBalance, PendingBalance, Currency, UpdatedAt)
    VALUES (NEWID(), @ShopId, 5000000, 0, 'VND', @Now);
END
ELSE
BEGIN
    UPDATE dbo.Wallets
    SET AvailableBalance = CASE WHEN AvailableBalance < 1000000 THEN 5000000 ELSE AvailableBalance END,
        UpdatedAt = @Now
    WHERE ShopId = @ShopId;
END;

/* ---------- helper: upsert order + item + payment ---------- */
/* RET-ELIGIBLE - Delivered, no return (buyer UC-43) */
IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE OrderId = @OEligible)
BEGIN
    INSERT INTO dbo.Orders (
        OrderId, OrderCode, BuyerUserId, ShopId, ShippingAddressId, ShippingSnapshotJson,
        Status, SubtotalAmount, DiscountAmount, ShippingFee, TotalAmount, Currency,
        TrackingCode, PaidAt, DeliveredAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @OEligible, N'RET-ELIGIBLE', @BuyerId, @ShopId, @AddressId, @ShippingJson,
        N'Delivered', @LineTotal, 0, @ShipFee, @Total, 'VND',
        N'TV-ELIG-001', DATEADD(DAY, -7, @Now), DATEADD(DAY, -2, @Now), DATEADD(DAY, -8, @Now), @Now
    );

    INSERT INTO dbo.OrderItems (
        OrderItemId, OrderId, ProductId, ProductNameSnapshot, SkuSnapshot,
        UnitPrice, UnitCostAvg, Quantity, LineTotal
    )
    VALUES (
        @OiEligible, @OEligible, @ProductId, @ProductName, N'RET-SKU',
        @UnitPrice, ROUND(@UnitPrice * 0.72, 0), 1, @LineTotal
    );

    INSERT INTO dbo.Payments (
        PaymentId, OrderId, Provider, ProviderPaymentId, Amount, Currency, Status, PaidAt, CreatedAt, UpdatedAt
    )
    VALUES (
        NEWID(), @OEligible, N'payOS', N'ret-eligible-pay', @Total, 'VND', N'Succeeded',
        DATEADD(DAY, -7, @Now), DATEADD(DAY, -8, @Now), @Now
    );

    INSERT INTO dbo.OrderStatusHistories (OrderId, FromStatus, ToStatus, ChangedBy, Note, CreatedAt)
    VALUES
        (@OEligible, N'PendingPayment', N'Paid', @BuyerId, N'Demo paid', DATEADD(DAY, -7, @Now)),
        (@OEligible, N'Paid', N'Shipping', @SellerId, N'Demo shipped', DATEADD(DAY, -4, @Now)),
        (@OEligible, N'Shipping', N'Delivered', NULL, N'Demo delivered', DATEADD(DAY, -2, @Now));
END;

/* RET-PENDING */
IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE OrderId = @OPending)
BEGIN
    INSERT INTO dbo.Orders (
        OrderId, OrderCode, BuyerUserId, ShopId, ShippingAddressId, ShippingSnapshotJson,
        Status, SubtotalAmount, DiscountAmount, ShippingFee, TotalAmount, Currency,
        TrackingCode, PaidAt, DeliveredAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @OPending, N'RET-PENDING', @BuyerId, @ShopId, @AddressId, @ShippingJson,
        N'ReturnRequested', @LineTotal, 0, @ShipFee, @Total, 'VND',
        N'TV-PEND-001', DATEADD(DAY, -10, @Now), DATEADD(DAY, -5, @Now), DATEADD(DAY, -11, @Now), @Now
    );

    INSERT INTO dbo.OrderItems (
        OrderItemId, OrderId, ProductId, ProductNameSnapshot, SkuSnapshot,
        UnitPrice, UnitCostAvg, Quantity, LineTotal
    )
    VALUES (
        @OiPending, @OPending, @ProductId, @ProductName, N'RET-SKU',
        @UnitPrice, ROUND(@UnitPrice * 0.72, 0), 1, @LineTotal
    );

    INSERT INTO dbo.Payments (
        PaymentId, OrderId, Provider, ProviderPaymentId, Amount, Currency, Status, PaidAt, CreatedAt, UpdatedAt
    )
    VALUES (
        NEWID(), @OPending, N'payOS', N'ret-pending-pay', @Total, 'VND', N'Succeeded',
        DATEADD(DAY, -10, @Now), DATEADD(DAY, -11, @Now), @Now
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.ReturnRequests WHERE ReturnRequestId = @RPending)
BEGIN
    INSERT INTO dbo.ReturnRequests (
        ReturnRequestId, OrderId, BuyerUserId, Reason, Description, ResolutionType, Status,
        RefundAmount, CreatedAt, UpdatedAt
    )
    VALUES (
        @RPending, @OPending, @BuyerId,
        N'Device does not power on after delivery',
        N'Screen stays black; tried original charger for 30 minutes.',
        N'ReturnRefund', N'Pending', @Total,
        DATEADD(HOUR, -20, @Now), DATEADD(HOUR, -20, @Now)
    );

    INSERT INTO dbo.ReturnRequestItems (ReturnItemId, ReturnRequestId, OrderItemId, Quantity)
    VALUES (NEWID(), @RPending, @OiPending, 1);

    INSERT INTO dbo.ReturnEvidences (EvidenceId, ReturnRequestId, EvidenceType, MediaUrl, SortOrder, CreatedAt)
    VALUES
        (NEWID(), @RPending, N'Unboxing', @UnboxUrl, 0, DATEADD(HOUR, -20, @Now)),
        (NEWID(), @RPending, N'Testing', @TestUrl, 1, DATEADD(HOUR, -20, @Now));

    INSERT INTO dbo.ReturnStatusHistories (ReturnRequestId, FromStatus, ToStatus, ChangedBy, Note, CreatedAt)
    VALUES (@RPending, NULL, N'Pending', @BuyerId, N'Buyer submitted return', DATEADD(HOUR, -20, @Now));
END;

/* RET-APPROVED */
IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE OrderId = @OApproved)
BEGIN
    INSERT INTO dbo.Orders (
        OrderId, OrderCode, BuyerUserId, ShopId, ShippingAddressId, ShippingSnapshotJson,
        Status, SubtotalAmount, DiscountAmount, ShippingFee, TotalAmount, Currency,
        TrackingCode, PaidAt, DeliveredAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @OApproved, N'RET-APPROVED', @BuyerId, @ShopId, @AddressId, @ShippingJson,
        N'ReturnRequested', @LineTotal, 0, @ShipFee, @Total, 'VND',
        N'TV-APPR-001', DATEADD(DAY, -14, @Now), DATEADD(DAY, -8, @Now), DATEADD(DAY, -15, @Now), @Now
    );

    INSERT INTO dbo.OrderItems (
        OrderItemId, OrderId, ProductId, ProductNameSnapshot, SkuSnapshot,
        UnitPrice, UnitCostAvg, Quantity, LineTotal
    )
    VALUES (
        @OiApproved, @OApproved, @ProductId, @ProductName, N'RET-SKU',
        @UnitPrice, ROUND(@UnitPrice * 0.72, 0), 1, @LineTotal
    );

    INSERT INTO dbo.Payments (
        PaymentId, OrderId, Provider, ProviderPaymentId, Amount, Currency, Status, PaidAt, CreatedAt, UpdatedAt
    )
    VALUES (
        NEWID(), @OApproved, N'payOS', N'ret-approved-pay', @Total, 'VND', N'Succeeded',
        DATEADD(DAY, -14, @Now), DATEADD(DAY, -15, @Now), @Now
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.ReturnRequests WHERE ReturnRequestId = @RApproved)
BEGIN
    INSERT INTO dbo.ReturnRequests (
        ReturnRequestId, OrderId, BuyerUserId, Reason, Description, ResolutionType, Status,
        RefundAmount, AdminNote, ReviewedBy, ReviewedAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @RApproved, @OApproved, @BuyerId,
        N'Scratched screen under factory seal',
        N'Unboxing shows scratch before buyer use.',
        N'ReturnRefund', N'Approved', @Total,
        N'Evidence valid - approve return.',
        @AdminId, DATEADD(HOUR, -6, @Now), DATEADD(DAY, -3, @Now), DATEADD(HOUR, -6, @Now)
    );

    INSERT INTO dbo.ReturnRequestItems (ReturnItemId, ReturnRequestId, OrderItemId, Quantity)
    VALUES (NEWID(), @RApproved, @OiApproved, 1);

    INSERT INTO dbo.ReturnEvidences (EvidenceId, ReturnRequestId, EvidenceType, MediaUrl, SortOrder, CreatedAt)
    VALUES
        (NEWID(), @RApproved, N'Unboxing', @UnboxUrl, 0, DATEADD(DAY, -3, @Now)),
        (NEWID(), @RApproved, N'Testing', @TestUrl, 1, DATEADD(DAY, -3, @Now));

    INSERT INTO dbo.ReturnStatusHistories (ReturnRequestId, FromStatus, ToStatus, ChangedBy, Note, CreatedAt)
    VALUES
        (@RApproved, NULL, N'Pending', @BuyerId, N'Buyer submitted return', DATEADD(DAY, -3, @Now)),
        (@RApproved, N'Pending', N'Approved', @AdminId, N'Admin approved and forwarded to seller', DATEADD(HOUR, -6, @Now));
END;

/* RET-RECV (Receiving) */
IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE OrderId = @ORecv)
BEGIN
    INSERT INTO dbo.Orders (
        OrderId, OrderCode, BuyerUserId, ShopId, ShippingAddressId, ShippingSnapshotJson,
        Status, SubtotalAmount, DiscountAmount, ShippingFee, TotalAmount, Currency,
        TrackingCode, PaidAt, DeliveredAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @ORecv, N'RET-RECV', @BuyerId, @ShopId, @AddressId, @ShippingJson,
        N'ReturnRequested', @LineTotal, 0, @ShipFee, @Total, 'VND',
        N'TV-RECV-001', DATEADD(DAY, -18, @Now), DATEADD(DAY, -12, @Now), DATEADD(DAY, -19, @Now), @Now
    );

    INSERT INTO dbo.OrderItems (
        OrderItemId, OrderId, ProductId, ProductNameSnapshot, SkuSnapshot,
        UnitPrice, UnitCostAvg, Quantity, LineTotal
    )
    VALUES (
        @OiRecv, @ORecv, @ProductId, @ProductName, N'RET-SKU',
        @UnitPrice, ROUND(@UnitPrice * 0.72, 0), 1, @LineTotal
    );

    INSERT INTO dbo.Payments (
        PaymentId, OrderId, Provider, ProviderPaymentId, Amount, Currency, Status, PaidAt, CreatedAt, UpdatedAt
    )
    VALUES (
        NEWID(), @ORecv, N'payOS', N'ret-recv-pay', @Total, 'VND', N'Succeeded',
        DATEADD(DAY, -18, @Now), DATEADD(DAY, -19, @Now), @Now
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.ReturnRequests WHERE ReturnRequestId = @RRecv)
BEGIN
    INSERT INTO dbo.ReturnRequests (
        ReturnRequestId, OrderId, BuyerUserId, Reason, Description, ResolutionType, Status,
        RefundAmount, AdminNote, ReviewedBy, ReviewedAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @RRecv, @ORecv, @BuyerId,
        N'Wrong model shipped',
        N'Ordered 256GB, received 128GB.',
        N'ReturnRefund', N'Receiving', @Total,
        N'Approved - waiting for parcel.',
        @AdminId, DATEADD(DAY, -2, @Now), DATEADD(DAY, -4, @Now), DATEADD(HOUR, -2, @Now)
    );

    INSERT INTO dbo.ReturnRequestItems (ReturnItemId, ReturnRequestId, OrderItemId, Quantity)
    VALUES (NEWID(), @RRecv, @OiRecv, 1);

    INSERT INTO dbo.ReturnEvidences (EvidenceId, ReturnRequestId, EvidenceType, MediaUrl, SortOrder, CreatedAt)
    VALUES
        (NEWID(), @RRecv, N'Unboxing', @UnboxUrl, 0, DATEADD(DAY, -4, @Now)),
        (NEWID(), @RRecv, N'Testing', @TestUrl, 1, DATEADD(DAY, -4, @Now));

    INSERT INTO dbo.ReturnStatusHistories (ReturnRequestId, FromStatus, ToStatus, ChangedBy, Note, CreatedAt)
    VALUES
        (@RRecv, NULL, N'Pending', @BuyerId, N'Buyer submitted return', DATEADD(DAY, -4, @Now)),
        (@RRecv, N'Pending', N'Approved', @AdminId, N'Admin approved and forwarded to seller', DATEADD(DAY, -2, @Now)),
        (@RRecv, N'Approved', N'SellerConfirmed', @SellerId, N'Seller confirmed ReturnRefund', DATEADD(DAY, -1, @Now)),
        (@RRecv, N'SellerConfirmed', N'Receiving', @SellerId, N'Seller marked returned goods as receiving', DATEADD(HOUR, -2, @Now));
END;

/* RET-REJECTED */
IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE OrderId = @ORejected)
BEGIN
    INSERT INTO dbo.Orders (
        OrderId, OrderCode, BuyerUserId, ShopId, ShippingAddressId, ShippingSnapshotJson,
        Status, SubtotalAmount, DiscountAmount, ShippingFee, TotalAmount, Currency,
        TrackingCode, PaidAt, DeliveredAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @ORejected, N'RET-REJECTED', @BuyerId, @ShopId, @AddressId, @ShippingJson,
        N'Delivered', @LineTotal, 0, @ShipFee, @Total, 'VND',
        N'TV-REJ-001', DATEADD(DAY, -20, @Now), DATEADD(DAY, -14, @Now), DATEADD(DAY, -21, @Now), @Now
    );

    INSERT INTO dbo.OrderItems (
        OrderItemId, OrderId, ProductId, ProductNameSnapshot, SkuSnapshot,
        UnitPrice, UnitCostAvg, Quantity, LineTotal
    )
    VALUES (
        @OiRejected, @ORejected, @ProductId, @ProductName, N'RET-SKU',
        @UnitPrice, ROUND(@UnitPrice * 0.72, 0), 1, @LineTotal
    );

    INSERT INTO dbo.Payments (
        PaymentId, OrderId, Provider, ProviderPaymentId, Amount, Currency, Status, PaidAt, CreatedAt, UpdatedAt
    )
    VALUES (
        NEWID(), @ORejected, N'payOS', N'ret-rejected-pay', @Total, 'VND', N'Succeeded',
        DATEADD(DAY, -20, @Now), DATEADD(DAY, -21, @Now), @Now
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.ReturnRequests WHERE ReturnRequestId = @RRejected)
BEGIN
    INSERT INTO dbo.ReturnRequests (
        ReturnRequestId, OrderId, BuyerUserId, Reason, Description, ResolutionType, Status,
        RefundAmount, AdminNote, ReviewedBy, ReviewedAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @RRejected, @ORejected, @BuyerId,
        N'Changed mind after unboxing',
        N'No defect claimed.',
        N'ReturnRefund', N'Rejected', @Total,
        N'Rejected: buyer remorse is outside return policy for this listing.',
        @AdminId, DATEADD(DAY, -1, @Now), DATEADD(DAY, -5, @Now), DATEADD(DAY, -1, @Now)
    );

    INSERT INTO dbo.ReturnRequestItems (ReturnItemId, ReturnRequestId, OrderItemId, Quantity)
    VALUES (NEWID(), @RRejected, @OiRejected, 1);

    INSERT INTO dbo.ReturnEvidences (EvidenceId, ReturnRequestId, EvidenceType, MediaUrl, SortOrder, CreatedAt)
    VALUES
        (NEWID(), @RRejected, N'Unboxing', @UnboxUrl, 0, DATEADD(DAY, -5, @Now)),
        (NEWID(), @RRejected, N'Testing', @TestUrl, 1, DATEADD(DAY, -5, @Now));

    INSERT INTO dbo.ReturnStatusHistories (ReturnRequestId, FromStatus, ToStatus, ChangedBy, Note, CreatedAt)
    VALUES
        (@RRejected, NULL, N'Pending', @BuyerId, N'Buyer submitted return', DATEADD(DAY, -5, @Now)),
        (@RRejected, N'Pending', N'Rejected', @AdminId,
         N'Rejected: buyer remorse is outside return policy for this listing.', DATEADD(DAY, -1, @Now));
END;

/* RET-CLOSED (Refunded → Closed; payment already Refunded) */
IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE OrderId = @OClosed)
BEGIN
    INSERT INTO dbo.Orders (
        OrderId, OrderCode, BuyerUserId, ShopId, ShippingAddressId, ShippingSnapshotJson,
        Status, SubtotalAmount, DiscountAmount, ShippingFee, TotalAmount, Currency,
        TrackingCode, PaidAt, DeliveredAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @OClosed, N'RET-CLOSED', @BuyerId, @ShopId, @AddressId, @ShippingJson,
        N'Returned', @LineTotal, 0, @ShipFee, @Total, 'VND',
        N'TV-CLS-001', DATEADD(DAY, -30, @Now), DATEADD(DAY, -24, @Now), DATEADD(DAY, -31, @Now), @Now
    );

    INSERT INTO dbo.OrderItems (
        OrderItemId, OrderId, ProductId, ProductNameSnapshot, SkuSnapshot,
        UnitPrice, UnitCostAvg, Quantity, LineTotal
    )
    VALUES (
        @OiClosed, @OClosed, @ProductId, @ProductName, N'RET-SKU',
        @UnitPrice, ROUND(@UnitPrice * 0.72, 0), 1, @LineTotal
    );

    INSERT INTO dbo.Payments (
        PaymentId, OrderId, Provider, ProviderPaymentId, Amount, Currency, Status, PaidAt, CreatedAt, UpdatedAt
    )
    VALUES (
        NEWID(), @OClosed, N'payOS', N'ret-closed-pay', @Total, 'VND', N'Refunded',
        DATEADD(DAY, -30, @Now), DATEADD(DAY, -31, @Now), @Now
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.ReturnRequests WHERE ReturnRequestId = @RClosed)
BEGIN
    INSERT INTO dbo.ReturnRequests (
        ReturnRequestId, OrderId, BuyerUserId, Reason, Description, ResolutionType, Status,
        RefundAmount, AdminNote, ReviewedBy, ReviewedAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @RClosed, @OClosed, @BuyerId,
        N'Dead pixels on display',
        N'Testing video shows dead pixels cluster.',
        N'ReturnRefund', N'Closed', @Total,
        N'Refunded and closed.',
        @AdminId, DATEADD(DAY, -10, @Now), DATEADD(DAY, -12, @Now), DATEADD(DAY, -8, @Now)
    );

    INSERT INTO dbo.ReturnRequestItems (ReturnItemId, ReturnRequestId, OrderItemId, Quantity)
    VALUES (NEWID(), @RClosed, @OiClosed, 1);

    INSERT INTO dbo.ReturnEvidences (EvidenceId, ReturnRequestId, EvidenceType, MediaUrl, SortOrder, CreatedAt)
    VALUES
        (NEWID(), @RClosed, N'Unboxing', @UnboxUrl, 0, DATEADD(DAY, -12, @Now)),
        (NEWID(), @RClosed, N'Testing', @TestUrl, 1, DATEADD(DAY, -12, @Now));

    INSERT INTO dbo.ReturnStatusHistories (ReturnRequestId, FromStatus, ToStatus, ChangedBy, Note, CreatedAt)
    VALUES
        (@RClosed, NULL, N'Pending', @BuyerId, N'Buyer submitted return', DATEADD(DAY, -12, @Now)),
        (@RClosed, N'Pending', N'Approved', @AdminId, N'Approved', DATEADD(DAY, -10, @Now)),
        (@RClosed, N'Approved', N'Receiving', @AdminId, N'Parcel received', DATEADD(DAY, -9, @Now)),
        (@RClosed, N'Receiving', N'Refunded', @AdminId, N'Buyer refunded via payOS payout', DATEADD(DAY, -8, @Now) ),
        (@RClosed, N'Refunded', N'Closed', @AdminId, N'Case closed', DATEADD(DAY, -8, @Now));
END;

PRINT N'Return & Refund demo seed completed.';
GO


/*
  seed-data-validate.sql - full-database integrity checks (read-only).
  Each SELECT returns rows only when a rule is violated.
  Issue column groups results by rule id.
*/

SET NOCOUNT ON;

/* ========================================================================== */
/* A. DENORMALIZED COUNTERS & STOCK (business-critical)                       */
/* ========================================================================== */

SELECT Issue = N'StockLotMismatch', p.ProductId, p.Name, p.StockQuantity,
    LotRemaining = ISNULL(SUM(CASE WHEN l.Status <> N'Void' THEN l.QuantityRemaining END), 0)
FROM dbo.Products p
LEFT JOIN dbo.InventoryLots l ON l.ProductId = p.ProductId
GROUP BY p.ProductId, p.Name, p.StockQuantity
HAVING p.StockQuantity <> ISNULL(SUM(CASE WHEN l.Status <> N'Void' THEN l.QuantityRemaining END), 0);

SELECT Issue = N'NoOpenLotsForStock', p.ProductId, p.Name, p.StockQuantity, p.ReservedQuantity
FROM dbo.Products p
WHERE p.Status = N'Approved'
  AND p.StockQuantity - p.ReservedQuantity > 0
  AND NOT EXISTS (
      SELECT 1 FROM dbo.InventoryLots l
      WHERE l.ProductId = p.ProductId AND l.Status = N'Open' AND l.QuantityRemaining > 0);

SELECT Issue = N'ReservedExceedsStock', ProductId, Name, StockQuantity, ReservedQuantity
FROM dbo.Products WHERE ReservedQuantity > StockQuantity;

SELECT Issue = N'ShopProductCountDrift', s.ShopId, s.ShopName, s.ProductCount AS StoredCount,
    ActualCount = (SELECT COUNT(*) FROM dbo.Products p WHERE p.ShopId = s.ShopId AND p.Status = N'Approved')
FROM dbo.Shops s
WHERE s.ProductCount <> (SELECT COUNT(*) FROM dbo.Products p WHERE p.ShopId = s.ShopId AND p.Status = N'Approved');

SELECT Issue = N'ShopFollowerCountDrift', s.ShopId, s.ShopName, s.FollowerCount AS StoredCount,
    ActualCount = (SELECT COUNT(*) FROM dbo.SellerFollows f WHERE f.ShopId = s.ShopId)
FROM dbo.Shops s
WHERE s.FollowerCount <> (SELECT COUNT(*) FROM dbo.SellerFollows f WHERE f.ShopId = s.ShopId);

SELECT Issue = N'ShopRatingDrift', s.ShopId, s.ShopName, s.RatingCount AS StoredCount, s.AvgRating AS StoredAvg,
    ActualCount = (SELECT COUNT(*) FROM dbo.SellerRatings r WHERE r.ShopId = s.ShopId),
    ActualAvg = ISNULL((SELECT CAST(ROUND(AVG(CAST(Score AS DECIMAL(5,2))), 2) AS DECIMAL(3,2))
        FROM dbo.SellerRatings r WHERE r.ShopId = s.ShopId), 0)
FROM dbo.Shops s
WHERE s.RatingCount <> (SELECT COUNT(*) FROM dbo.SellerRatings r WHERE r.ShopId = s.ShopId)
   OR s.AvgRating <> ISNULL((SELECT CAST(ROUND(AVG(CAST(Score AS DECIMAL(5,2))), 2) AS DECIMAL(3,2))
        FROM dbo.SellerRatings r WHERE r.ShopId = s.ShopId), 0);

SELECT Issue = N'ShopMissingWallet', s.ShopId, s.ShopName
FROM dbo.Shops s
WHERE NOT EXISTS (SELECT 1 FROM dbo.Wallets w WHERE w.ShopId = s.ShopId);

SELECT Issue = N'ProductReviewDrift', p.ProductId, p.Name, p.ReviewCount AS StoredCount, p.AvgRating AS StoredAvg,
    ActualCount = (SELECT COUNT(*) FROM dbo.ProductReviews r WHERE r.ProductId = p.ProductId AND r.IsVisible = 1),
    ActualAvg = ISNULL((SELECT CAST(ROUND(AVG(CAST(Rating AS DECIMAL(5,2))), 2) AS DECIMAL(3,2))
        FROM dbo.ProductReviews r WHERE r.ProductId = p.ProductId AND r.IsVisible = 1), 0)
FROM dbo.Products p
WHERE p.ReviewCount <> (SELECT COUNT(*) FROM dbo.ProductReviews r WHERE r.ProductId = p.ProductId AND r.IsVisible = 1)
   OR p.AvgRating <> ISNULL((SELECT CAST(ROUND(AVG(CAST(Rating AS DECIMAL(5,2))), 2) AS DECIMAL(3,2))
        FROM dbo.ProductReviews r WHERE r.ProductId = p.ProductId AND r.IsVisible = 1), 0);

SELECT Issue = N'VoucherUsedCountDrift', v.VoucherId, v.Code, v.UsedCount AS StoredCount,
    ActualCount = (SELECT COUNT(*) FROM dbo.VoucherRedemptions r WHERE r.VoucherId = v.VoucherId)
FROM dbo.Vouchers v
WHERE v.UsedCount <> (SELECT COUNT(*) FROM dbo.VoucherRedemptions r WHERE r.VoucherId = v.VoucherId);

/* ========================================================================== */
/* B. ORPHAN / BROKEN FK (every child table)                                  */
/* ========================================================================== */

SELECT Issue = N'OrphanUserRole', ur.UserId, ur.RoleId
FROM dbo.UserRoles ur
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = ur.UserId)
   OR NOT EXISTS (SELECT 1 FROM dbo.Roles r WHERE r.RoleId = ur.RoleId);

SELECT Issue = N'OrphanAddress', a.AddressId, a.UserId
FROM dbo.Addresses a
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = a.UserId);

SELECT Issue = N'OrphanPasswordResetToken', t.TokenId, t.UserId
FROM dbo.PasswordResetTokens t
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = t.UserId);

SELECT Issue = N'OrphanShopOwner', s.ShopId, s.ShopName, s.OwnerUserId
FROM dbo.Shops s
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = s.OwnerUserId);

SELECT Issue = N'OrphanSellerRegistration', r.RequestId, r.UserId
FROM dbo.SellerRegistrationRequests r
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = r.UserId);

SELECT Issue = N'OrphanSellerFollow', f.BuyerUserId, f.ShopId
FROM dbo.SellerFollows f
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = f.BuyerUserId)
   OR NOT EXISTS (SELECT 1 FROM dbo.Shops s WHERE s.ShopId = f.ShopId);

SELECT Issue = N'OrphanSellerRating', sr.SellerRatingId, sr.ShopId, sr.BuyerUserId
FROM dbo.SellerRatings sr
WHERE NOT EXISTS (SELECT 1 FROM dbo.Shops s WHERE s.ShopId = sr.ShopId)
   OR NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = sr.BuyerUserId);

SELECT Issue = N'InvalidCategoryParent', c.CategoryId, c.Name, c.ParentId
FROM dbo.Categories c
WHERE c.ParentId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.Categories p WHERE p.CategoryId = c.ParentId);

SELECT Issue = N'OrphanProduct', p.ProductId, p.Name, p.ShopId, p.CategoryId
FROM dbo.Products p
WHERE NOT EXISTS (SELECT 1 FROM dbo.Shops s WHERE s.ShopId = p.ShopId)
   OR NOT EXISTS (SELECT 1 FROM dbo.Categories c WHERE c.CategoryId = p.CategoryId);

SELECT Issue = N'OrphanProductImage', pi.ProductImageId, pi.ProductId
FROM dbo.ProductImages pi
WHERE NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.ProductId = pi.ProductId);

SELECT Issue = N'OrphanProductVariant', v.VariantId, v.ProductId
FROM dbo.ProductVariants v
WHERE NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.ProductId = v.ProductId);

SELECT Issue = N'OrphanInventoryLot', l.LotId, l.ProductId, l.LotCode
FROM dbo.InventoryLots l
WHERE NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.ProductId = l.ProductId);

SELECT Issue = N'OrphanPriceHistory', h.PriceHistoryId, h.ProductId
FROM dbo.ProductPriceHistories h
WHERE NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.ProductId = h.ProductId);

SELECT Issue = N'OrphanInventoryTx', t.InventoryTxId, t.ProductId, t.LotId
FROM dbo.InventoryTransactions t
WHERE NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.ProductId = t.ProductId)
   OR (t.LotId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.InventoryLots l WHERE l.LotId = t.LotId));

SELECT Issue = N'OrphanProductModeration', m.ModerationId, m.ProductId
FROM dbo.ProductModerationHistory m
WHERE NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.ProductId = m.ProductId);

SELECT Issue = N'OrphanCart', c.CartId, c.UserId
FROM dbo.Carts c
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = c.UserId);

SELECT Issue = N'OrphanCartItem', ci.CartItemId, ci.CartId, ci.ProductId
FROM dbo.CartItems ci
WHERE NOT EXISTS (SELECT 1 FROM dbo.Carts c WHERE c.CartId = ci.CartId)
   OR NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.ProductId = ci.ProductId);

SELECT Issue = N'OrphanWishlistItem', w.WishlistItemId, w.UserId, w.ProductId
FROM dbo.WishlistItems w
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = w.UserId)
   OR NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.ProductId = w.ProductId);

SELECT Issue = N'OrphanVoucher', v.VoucherId, v.Code, v.ShopId, v.CreatedBy
FROM dbo.Vouchers v
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = v.CreatedBy)
   OR (v.Scope = N'Shop' AND NOT EXISTS (SELECT 1 FROM dbo.Shops s WHERE s.ShopId = v.ShopId))
   OR (v.Scope = N'System' AND v.ShopId IS NOT NULL);

SELECT Issue = N'OrphanVoucherRedemption', vr.RedemptionId, vr.VoucherId, vr.UserId
FROM dbo.VoucherRedemptions vr
WHERE NOT EXISTS (SELECT 1 FROM dbo.Vouchers v WHERE v.VoucherId = vr.VoucherId)
   OR NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = vr.UserId);

SELECT Issue = N'OrphanOrder', o.OrderId, o.OrderCode, o.BuyerUserId, o.ShopId
FROM dbo.Orders o
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = o.BuyerUserId)
   OR NOT EXISTS (SELECT 1 FROM dbo.Shops s WHERE s.ShopId = o.ShopId);

SELECT Issue = N'OrphanOrderItem', oi.OrderItemId, oi.OrderId, oi.ProductId
FROM dbo.OrderItems oi
WHERE NOT EXISTS (SELECT 1 FROM dbo.Orders o WHERE o.OrderId = oi.OrderId)
   OR NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.ProductId = oi.ProductId);

SELECT Issue = N'OrphanLotAllocation', a.AllocationId, a.OrderItemId, a.LotId
FROM dbo.OrderItemLotAllocations a
WHERE NOT EXISTS (SELECT 1 FROM dbo.OrderItems oi WHERE oi.OrderItemId = a.OrderItemId)
   OR NOT EXISTS (SELECT 1 FROM dbo.InventoryLots l WHERE l.LotId = a.LotId);

SELECT Issue = N'OrphanOrderStatusHistory', h.HistoryId, h.OrderId
FROM dbo.OrderStatusHistories h
WHERE NOT EXISTS (SELECT 1 FROM dbo.Orders o WHERE o.OrderId = h.OrderId);

SELECT Issue = N'OrphanPayment', pay.PaymentId, pay.OrderId
FROM dbo.Payments pay
WHERE NOT EXISTS (SELECT 1 FROM dbo.Orders o WHERE o.OrderId = pay.OrderId);

SELECT Issue = N'OrphanReturnRequest', rr.ReturnRequestId, rr.OrderId
FROM dbo.ReturnRequests rr
WHERE NOT EXISTS (SELECT 1 FROM dbo.Orders o WHERE o.OrderId = rr.OrderId);

SELECT Issue = N'OrphanReturnItem', ri.ReturnItemId, ri.ReturnRequestId, ri.OrderItemId
FROM dbo.ReturnRequestItems ri
WHERE NOT EXISTS (SELECT 1 FROM dbo.ReturnRequests rr WHERE rr.ReturnRequestId = ri.ReturnRequestId)
   OR NOT EXISTS (SELECT 1 FROM dbo.OrderItems oi WHERE oi.OrderItemId = ri.OrderItemId);

SELECT Issue = N'OrphanReturnEvidence', e.EvidenceId, e.ReturnRequestId
FROM dbo.ReturnEvidences e
WHERE NOT EXISTS (SELECT 1 FROM dbo.ReturnRequests rr WHERE rr.ReturnRequestId = e.ReturnRequestId);

SELECT Issue = N'OrphanReturnStatusHistory', h.HistoryId, h.ReturnRequestId
FROM dbo.ReturnStatusHistories h
WHERE NOT EXISTS (SELECT 1 FROM dbo.ReturnRequests rr WHERE rr.ReturnRequestId = h.ReturnRequestId);

SELECT Issue = N'OrphanProductReview', r.ReviewId, r.ProductId, r.BuyerUserId
FROM dbo.ProductReviews r
WHERE NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.ProductId = r.ProductId)
   OR NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = r.BuyerUserId);

SELECT Issue = N'OrphanNotification', n.NotificationId, n.UserId
FROM dbo.Notifications n
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = n.UserId);

SELECT Issue = N'OrphanChatThread', ct.ThreadId, ct.BuyerUserId, ct.ShopId
FROM dbo.ChatThreads ct
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = ct.BuyerUserId)
   OR NOT EXISTS (SELECT 1 FROM dbo.Shops s WHERE s.ShopId = ct.ShopId);

SELECT Issue = N'OrphanChatMessage', cm.MessageId, cm.ThreadId
FROM dbo.ChatMessages cm
WHERE NOT EXISTS (SELECT 1 FROM dbo.ChatThreads ct WHERE ct.ThreadId = cm.ThreadId);

SELECT Issue = N'OrphanWallet', w.WalletId, w.ShopId
FROM dbo.Wallets w
WHERE NOT EXISTS (SELECT 1 FROM dbo.Shops s WHERE s.ShopId = w.ShopId);

SELECT Issue = N'OrphanWalletTransaction', wt.WalletTxId, wt.WalletId
FROM dbo.WalletTransactions wt
WHERE NOT EXISTS (SELECT 1 FROM dbo.Wallets w WHERE w.WalletId = wt.WalletId);

SELECT Issue = N'OrphanViewHistory', v.ViewId, v.UserId, v.ProductId
FROM dbo.ViewedProductHistories v
WHERE NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.ProductId = v.ProductId)
   OR (v.UserId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = v.UserId));

SELECT Issue = N'OrphanProductRecommendation', pr.RecommendationId, pr.UserId, pr.ProductId
FROM dbo.ProductRecommendations pr
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = pr.UserId)
   OR NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.ProductId = pr.ProductId);

SELECT Issue = N'OrphanAiConversation', c.ConversationId, c.UserId
FROM dbo.AiConversations c
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = c.UserId);

SELECT Issue = N'OrphanAiMessage', m.AiMessageId, m.ConversationId
FROM dbo.AiMessages m
WHERE NOT EXISTS (SELECT 1 FROM dbo.AiConversations c WHERE c.ConversationId = m.ConversationId);

/* ========================================================================== */
/* C. BUSINESS RULE VIOLATIONS                                                */
/* ========================================================================== */

SELECT Issue = N'UserWithoutRole', u.UserId, u.Email
FROM dbo.Users u
WHERE NOT EXISTS (SELECT 1 FROM dbo.UserRoles ur WHERE ur.UserId = u.UserId);

SELECT Issue = N'ShopOwnerMissingSellerRole', s.ShopId, s.ShopName, s.OwnerUserId
FROM dbo.Shops s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.UserRoles ur
    INNER JOIN dbo.Roles r ON r.RoleId = ur.RoleId
    WHERE ur.UserId = s.OwnerUserId AND r.RoleCode = N'SELLER');

SELECT Issue = N'ApprovedProductInactiveCategory', p.ProductId, p.Name, p.CategoryId, c.IsActive
FROM dbo.Products p
INNER JOIN dbo.Categories c ON c.CategoryId = p.CategoryId
WHERE p.Status = N'Approved' AND c.IsActive = 0;

SELECT Issue = N'ApprovedProductInactiveShop', p.ProductId, p.Name, p.ShopId, s.Status
FROM dbo.Products p
INNER JOIN dbo.Shops s ON s.ShopId = p.ShopId
WHERE p.Status = N'Approved' AND s.Status <> N'Active';

SELECT Issue = N'InvalidLotQuantity', l.LotId, l.LotCode, l.QuantityReceived, l.QuantityRemaining
FROM dbo.InventoryLots l
WHERE l.QuantityRemaining > l.QuantityReceived OR l.QuantityRemaining < 0;

SELECT Issue = N'LotAllocationQtyMismatch', oi.OrderItemId, oi.Quantity AS OrderQty,
    AllocatedQty = ISNULL(SUM(a.Quantity), 0)
FROM dbo.OrderItems oi
INNER JOIN dbo.Orders o ON o.OrderId = oi.OrderId
LEFT JOIN dbo.OrderItemLotAllocations a ON a.OrderItemId = oi.OrderItemId
WHERE o.Status NOT IN (N'PendingPayment', N'Cancelled')
GROUP BY oi.OrderItemId, oi.Quantity
HAVING ISNULL(SUM(a.Quantity), 0) > 0 AND oi.Quantity <> ISNULL(SUM(a.Quantity), 0);

SELECT Issue = N'OrderLineTotalMismatch', oi.OrderItemId, oi.OrderId,
    oi.LineTotal, Expected = CAST(oi.UnitPrice * oi.Quantity AS DECIMAL(18,2))
FROM dbo.OrderItems oi
WHERE oi.LineTotal <> CAST(oi.UnitPrice * oi.Quantity AS DECIMAL(18,2));

SELECT Issue = N'OrderTotalMismatch', o.OrderId, o.OrderCode, o.TotalAmount,
    Expected = CAST(o.SubtotalAmount - o.DiscountAmount + o.ShippingFee AS DECIMAL(18,2))
FROM dbo.Orders o
WHERE o.TotalAmount <> CAST(o.SubtotalAmount - o.DiscountAmount + o.ShippingFee AS DECIMAL(18,2));

SELECT Issue = N'OrderMissingItems', o.OrderId, o.OrderCode
FROM dbo.Orders o
WHERE o.Status NOT IN (N'PendingPayment', N'Cancelled')
  AND NOT EXISTS (SELECT 1 FROM dbo.OrderItems oi WHERE oi.OrderId = o.OrderId);

SELECT Issue = N'CartItemExceedsStock', ci.CartItemId, ci.ProductId, ci.Quantity,
    p.StockQuantity, p.ReservedQuantity
FROM dbo.CartItems ci
INNER JOIN dbo.Products p ON p.ProductId = ci.ProductId
WHERE ci.Quantity > p.StockQuantity - p.ReservedQuantity;

SELECT Issue = N'MultiplePrimaryProductImages', pi.ProductId, PrimaryCount = COUNT(*)
FROM dbo.ProductImages pi
WHERE pi.IsPrimary = 1
GROUP BY pi.ProductId
HAVING COUNT(*) > 1;

SELECT Issue = N'InvalidProductRating', r.ReviewId, r.ProductId, r.Rating
FROM dbo.ProductReviews r
WHERE r.Rating NOT BETWEEN 1 AND 5;

SELECT Issue = N'InvalidSellerRating', sr.SellerRatingId, sr.Score
FROM dbo.SellerRatings sr
WHERE sr.Score NOT BETWEEN 1 AND 5;

SELECT Issue = N'VoucherInvalidPeriod', v.VoucherId, v.Code, v.StartsAt, v.EndsAt
FROM dbo.Vouchers v
WHERE v.EndsAt <= v.StartsAt;

SELECT Issue = N'ReturnMissingEvidence', rr.ReturnRequestId, rr.OrderId, rr.Status
FROM dbo.ReturnRequests rr
WHERE rr.Status NOT IN (N'Pending')
  AND NOT EXISTS (SELECT 1 FROM dbo.ReturnEvidences e WHERE e.ReturnRequestId = rr.ReturnRequestId);

SELECT Issue = N'PaymentSucceededAmountMismatch', pay.PaymentId, pay.OrderId, pay.Amount, o.TotalAmount
FROM dbo.Payments pay
INNER JOIN dbo.Orders o ON o.OrderId = pay.OrderId
WHERE pay.Status = N'Succeeded' AND pay.Amount <> o.TotalAmount;

/* ========================================================================== */
/* D. OPTIONAL MODULE TABLES (when schema applied)                            */
/* ========================================================================== */

IF OBJECT_ID(N'dbo.SettlementEntries', N'U') IS NOT NULL
BEGIN
    SELECT Issue = N'OrphanSettlementEntry', s.SettlementEntryId, s.OrderId, s.ShopId
    FROM dbo.SettlementEntries s
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Orders o WHERE o.OrderId = s.OrderId)
       OR NOT EXISTS (SELECT 1 FROM dbo.Shops sh WHERE sh.ShopId = s.ShopId);

    SELECT Issue = N'SettlementAmountMismatch', s.SettlementEntryId, s.OrderId,
        s.GrossAmount, s.CommissionAmount, s.NetAmount,
        ExpectedNet = CAST(s.GrossAmount - s.CommissionAmount AS DECIMAL(18,2))
    FROM dbo.SettlementEntries s
    WHERE s.NetAmount <> CAST(s.GrossAmount - s.CommissionAmount AS DECIMAL(18,2));

    SELECT Issue = N'CompletedOrderMissingSettlement', o.OrderId, o.OrderCode, o.Status
    FROM dbo.Orders o
    WHERE o.Status = N'Completed'
      AND NOT EXISTS (SELECT 1 FROM dbo.SettlementEntries s WHERE s.OrderId = o.OrderId);

    SELECT Issue = N'SettlementShopOrderMismatch', s.SettlementEntryId, s.OrderId, s.ShopId, o.ShopId AS OrderShopId
    FROM dbo.SettlementEntries s
    INNER JOIN dbo.Orders o ON o.OrderId = s.OrderId
    WHERE s.ShopId <> o.ShopId;
END;

IF OBJECT_ID(N'dbo.ShopBankAccounts', N'U') IS NOT NULL
BEGIN
    SELECT Issue = N'OrphanShopBankAccount', b.ShopBankAccountId, b.ShopId
    FROM dbo.ShopBankAccounts b
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Shops s WHERE s.ShopId = b.ShopId);
END;

IF OBJECT_ID(N'dbo.PayoutBatches', N'U') IS NOT NULL
BEGIN
    SELECT Issue = N'OrphanPayoutBatch', pb.PayoutBatchId, pb.ShopId
    FROM dbo.PayoutBatches pb
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Shops s WHERE s.ShopId = pb.ShopId);
END;

IF OBJECT_ID(N'dbo.Shipments', N'U') IS NOT NULL
BEGIN
    SELECT Issue = N'OrphanShipment', sh.ShipmentId, sh.OrderId
    FROM dbo.Shipments sh
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Orders o WHERE o.OrderId = sh.OrderId);

    SELECT Issue = N'ShipmentOrderStatusMismatch', sh.ShipmentId, sh.OrderId, sh.Status AS ShipmentStatus, o.Status AS OrderStatus
    FROM dbo.Shipments sh
    INNER JOIN dbo.Orders o ON o.OrderId = sh.OrderId
    WHERE sh.Status = N'Delivered' AND o.Status NOT IN (N'Delivered', N'Completed', N'ReturnRequested', N'Returned');
END;

IF OBJECT_ID(N'dbo.ShipmentEvents', N'U') IS NOT NULL
BEGIN
    SELECT Issue = N'OrphanShipmentEvent', e.ShipmentEventId, e.ShipmentId
    FROM dbo.ShipmentEvents e
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Shipments sh WHERE sh.ShipmentId = e.ShipmentId);
END;

IF OBJECT_ID(N'dbo.KycVerifications', N'U') IS NOT NULL
BEGIN
    SELECT Issue = N'OrphanKycVerification', k.KycVerificationId, k.UserId
    FROM dbo.KycVerifications k
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = k.UserId);
END;

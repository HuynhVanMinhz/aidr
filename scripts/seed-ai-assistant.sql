/*
  AIDR — Shopping Assistant demo seed (UC-56)
  Prerequisites:
    - POST /api/dev/seed-demo-accounts (demo buyer CCCC...)
    - POST /api/dev/seed-catalog (Approved products)

  Idempotent: skips when AI-SEED marker conversation already exists for demo buyer.
  Seeds:
    - One ShoppingAssistant AiConversation with FAQ + product-advice turns
    - AiMessages (user / assistant) with MetaJson product refs
*/

SET NOCOUNT ON;

DECLARE
    @BuyerId         UNIQUEIDENTIFIER = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC',
    @ConversationId  UNIQUEIDENTIFIER = 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAA56',
    @Now             DATETIME2(3) = SYSUTCDATETIME(),
    @ApprovedCount   INT,
    @ProductId       UNIQUEIDENTIFIER;

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @BuyerId)
BEGIN
    RAISERROR(N'Demo buyer missing. Run POST /api/dev/seed-demo-accounts first.', 16, 1);
    RETURN;
END;

SELECT @ApprovedCount = COUNT(*) FROM dbo.Products WHERE Status = N'Approved';
IF @ApprovedCount < 1
BEGIN
    RAISERROR(N'Not enough Approved products. Run POST /api/dev/seed-catalog first.', 16, 1);
    RETURN;
END;

IF EXISTS (
    SELECT 1
    FROM dbo.AiConversations
    WHERE ConversationId = @ConversationId
       OR (UserId = @BuyerId AND Title = N'AI-SEED shopping assistant demo')
)
BEGIN
    PRINT N'Shopping assistant demo seed already present — skipped.';
    RETURN;
END;

SET @ProductId = COALESCE(
    (SELECT TOP 1 ProductId FROM dbo.Products WHERE ProductId = 'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE' AND Status = N'Approved'),
    (SELECT TOP 1 ProductId FROM dbo.Products WHERE Status = N'Approved' ORDER BY SoldCount DESC));

INSERT INTO dbo.AiConversations (ConversationId, UserId, Channel, Title, CreatedAt, UpdatedAt)
VALUES (
    @ConversationId,
    @BuyerId,
    N'ShoppingAssistant',
    N'AI-SEED shopping assistant demo',
    DATEADD(MINUTE, -30, @Now),
    @Now
);

INSERT INTO dbo.AiMessages (ConversationId, Role, Content, MetaJson, CreatedAt)
VALUES
(
    @ConversationId,
    N'user',
    N'How do returns and refunds work?',
    NULL,
    DATEADD(MINUTE, -29, @Now)
),
(
    @ConversationId,
    N'assistant',
    N'You can request a return with full refund from your order detail after delivery. Upload unboxing/testing video evidence; our team reviews requests manually. AIDR does not offer same-item exchange — after a refund you can place a new order.',
    N'{"productIds":[],"source":"heuristic"}',
    DATEADD(MINUTE, -28, @Now)
),
(
    @ConversationId,
    N'user',
    N'Recommend a Samsung phone for me',
    NULL,
    DATEADD(MINUTE, -10, @Now)
),
(
    @ConversationId,
    N'assistant',
    N'Here are some Approved products that match your request. Open a product for specs, reviews, and Add to cart. You can also compare 2–5 products from the catalog.',
    CONCAT(N'{"productIds":["', CAST(@ProductId AS NVARCHAR(36)), N'"],"source":"heuristic"}'),
    DATEADD(MINUTE, -9, @Now)
);

PRINT N'Shopping assistant demo seed completed.';
GO

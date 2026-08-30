/*
  AIDR — Shopping Assistant demo seed (UC-56)
  Prerequisites:
    - POST /api/dev/seed-demo-accounts (demo buyer CCCC...)
    - POST /api/dev/seed-catalog (Approved products)

  Idempotent: skips when AI-SEED marker conversation already exists for demo buyer.
  Seeds:
    - One ShoppingAssistant AiConversation with FAQ + recommend + refine turns
    - One guided-consultation conversation paused mid-round (chips + progress restore on reopen)
    - AiMessages (user / assistant) with MetaJson slots / consult / product refs
*/

SET NOCOUNT ON;

DECLARE
    @BuyerId         UNIQUEIDENTIFIER = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC',
    @ConversationId  UNIQUEIDENTIFIER = 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAA56',
    @ConsultConvId   UNIQUEIDENTIFIER = 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAA57',
    @ConsultCatId    INT,
    @ConsultCatName  NVARCHAR(200),
    @SeedBase        BIT = 1,
    @Now             DATETIME2(3) = SYSUTCDATETIME(),
    @ApprovedCount   INT,
    @ProductId       UNIQUEIDENTIFIER,
    @Brand           NVARCHAR(100),
    @CategoryId      INT,
    @CategoryName    NVARCHAR(200),
    @MaxPrice        DECIMAL(18,0);

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
    PRINT N'Shopping assistant demo conversation already present — skipped.';
    SET @SeedBase = 0;
END;

SELECT TOP 1
    @ProductId = p.ProductId,
    @Brand = p.Brand,
    @CategoryId = p.CategoryId,
    @CategoryName = c.Name,
    @MaxPrice = CAST(CEILING(COALESCE(NULLIF(p.SalePrice, 0), p.BasePrice) * 1.2) AS DECIMAL(18,0))
FROM dbo.Products p
INNER JOIN dbo.Categories c ON c.CategoryId = p.CategoryId
WHERE p.Status = N'Approved'
ORDER BY
    CASE WHEN p.ProductId = 'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE' THEN 0 ELSE 1 END,
    p.SoldCount DESC;

IF @SeedBase = 1
INSERT INTO dbo.AiConversations (ConversationId, UserId, Channel, Title, CreatedAt, UpdatedAt)
VALUES (
    @ConversationId,
    @BuyerId,
    N'ShoppingAssistant',
    N'AI-SEED shopping assistant demo',
    DATEADD(MINUTE, -30, @Now),
    @Now
);

IF @SeedBase = 1
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
    N'You can request a return with full refund from your order detail after delivery. Upload unboxing and testing video evidence; our team reviews requests manually. AIDR does not offer same-item exchange — after a refund you can place a new order.',
    N'{"source":"heuristic","intent":"faq","productIds":[],"actions":[]}',
    DATEADD(MINUTE, -28, @Now)
),
(
    @ConversationId,
    N'user',
    N'Recommend a Samsung phone under 15 million',
    NULL,
    DATEADD(MINUTE, -12, @Now)
),
(
    @ConversationId,
    N'assistant',
    N'Here are Approved products that match your preferences. Open a product for specs and reviews, or ask me to refine by brand, budget, or rating.',
    CONCAT(
        N'{"source":"heuristic","intent":"recommend","slots":{"brand":"',
        COALESCE(@Brand, N'Samsung'),
        N'","categoryId":',
        COALESCE(CAST(@CategoryId AS NVARCHAR(20)), N'null'),
        N',"categoryName":"',
        COALESCE(REPLACE(@CategoryName, N'"', N''), N'Phones'),
        N'","maxPrice":',
        COALESCE(CAST(@MaxPrice AS NVARCHAR(30)), N'15000000'),
        N',"sort":"popular"},"productIds":["',
        CAST(@ProductId AS NVARCHAR(36)),
        N'"],"reasons":{"',
        CAST(@ProductId AS NVARCHAR(36)),
        N'":"within budget"},"actions":[{"type":"open_catalog","label":"See all matching products","productIds":[]}]}'
    ),
    DATEADD(MINUTE, -11, @Now)
),
(
    @ConversationId,
    N'user',
    N'Cheaper ones please',
    NULL,
    DATEADD(MINUTE, -5, @Now)
),
(
    @ConversationId,
    N'assistant',
    N'I refined the list toward lower prices while keeping your brand and category preferences.',
    CONCAT(
        N'{"source":"heuristic","intent":"refine","slots":{"brand":"',
        COALESCE(@Brand, N'Samsung'),
        N'","categoryId":',
        COALESCE(CAST(@CategoryId AS NVARCHAR(20)), N'null'),
        N',"categoryName":"',
        COALESCE(REPLACE(@CategoryName, N'"', N''), N'Phones'),
        N'","maxPrice":',
        COALESCE(CAST(CAST(@MaxPrice * 0.85 AS DECIMAL(18,0)) AS NVARCHAR(30)), N'12750000'),
        N',"sort":"price_asc"},"productIds":["',
        CAST(@ProductId AS NVARCHAR(36)),
        N'"],"reasons":{"',
        CAST(@ProductId AS NVARCHAR(36)),
        N'":"within budget · sort: price_asc"},"actions":[{"type":"open_catalog","label":"See all matching products","productIds":[]},{"type":"open_compare","label":"Compare these","productIds":["',
        CAST(@ProductId AS NVARCHAR(36)),
        N'"]}]}'
    ),
    DATEADD(MINUTE, -4, @Now)
);

/* ------------------------------------------------------------------------
   Guided consultation paused after two questions.
   Reopening it must restore the chips and the "Question 2/3" progress.
   ------------------------------------------------------------------------ */

SELECT TOP 1
    @ConsultCatId = c.CategoryId,
    @ConsultCatName = c.Name
FROM dbo.Categories c
WHERE c.IsActive = 1
  AND c.ParentId IS NULL
  AND EXISTS (SELECT 1 FROM dbo.Products p WHERE p.CategoryId = c.CategoryId AND p.Status = N'Approved')
ORDER BY
    CASE WHEN c.Slug = N'laptop' THEN 0 ELSE 1 END,
    c.SortOrder;

IF @ConsultCatId IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.AiConversations WHERE ConversationId = @ConsultConvId)
BEGIN
    INSERT INTO dbo.AiConversations (ConversationId, UserId, Channel, Title, CreatedAt, UpdatedAt)
    VALUES (
        @ConsultConvId,
        @BuyerId,
        N'ShoppingAssistant',
        N'AI-SEED guided consultation demo',
        DATEADD(MINUTE, -20, @Now),
        @Now
    );

    INSERT INTO dbo.AiMessages (ConversationId, Role, Content, MetaJson, CreatedAt)
    VALUES
    (
        @ConsultConvId,
        N'user',
        N'I want to buy a laptop',
        NULL,
        DATEADD(MINUTE, -19, @Now)
    ),
    (
        @ConsultConvId,
        N'assistant',
        N'Happy to help you pick one. What will you mostly use the laptop for?',
        CONCAT(
            N'{"source":"heuristic","intent":"clarify","slots":{"categoryId":',
            CAST(@ConsultCatId AS NVARCHAR(20)),
            N',"categoryName":"',
            REPLACE(@ConsultCatName, N'"', N''),
            N'"},"consult":{"roundId":1,"stage":"collecting","askedCount":1,',
            N'"asked":["useCase"],"pendingQuestion":"useCase","answers":{},',
            N'"relaxed":[],"shownIds":[],"skipped":false},"productIds":[],',
            N'"quickReplies":[',
            N'{"key":"useCase","label":"Work & study","value":"usecase=office"},',
            N'{"key":"useCase","label":"Gaming","value":"usecase=gaming"},',
            N'{"key":"useCase","label":"Design & video","value":"usecase=creative"},',
            N'{"key":"useCase","label":"Thin & portable","value":"usecase=portable"},',
            N'{"key":"useCase","label":"Not sure","value":"skip=useCase"}]}'
        ),
        DATEADD(MINUTE, -18, @Now)
    ),
    (
        @ConsultConvId,
        N'user',
        N'Gaming',
        NULL,
        DATEADD(MINUTE, -17, @Now)
    ),
    (
        @ConsultConvId,
        N'assistant',
        N'Got it. Roughly what budget are you working with?',
        CONCAT(
            N'{"source":"heuristic","intent":"clarify","slots":{"categoryId":',
            CAST(@ConsultCatId AS NVARCHAR(20)),
            N',"categoryName":"',
            REPLACE(@ConsultCatName, N'"', N''),
            N'"},"consult":{"roundId":1,"stage":"collecting","askedCount":2,',
            N'"asked":["useCase","budget"],"pendingQuestion":"budget",',
            N'"answers":{"useCase":"gaming"},"relaxed":[],"shownIds":[],"skipped":false},',
            N'"productIds":[],"quickReplies":[',
            N'{"key":"budget","label":"Under 18M \u20AB","value":"budget=:18000000"},',
            N'{"key":"budget","label":"18M \u20AB - 27M \u20AB","value":"budget=18000000:27000000"},',
            N'{"key":"budget","label":"Over 27M \u20AB","value":"budget=27000000:"},',
            N'{"key":"budget","label":"No fixed budget","value":"skip=budget"}]}'
        ),
        DATEADD(MINUTE, -16, @Now)
    );
END;

PRINT N'Shopping assistant demo seed completed.';
GO

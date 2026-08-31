/*
  AIDR — Product variants as the sellable unit.

  A product ("iPhone 17") is the shared shell: description, images, reviews.
  What a buyer actually pays for and what stock is drawn from is a VARIANT
  ("Orange / 128GB"), which carries its own price, SKU and inventory.

  dbo.ProductVariants already exists in database.sql but was never wired up,
  so this script both creates it when missing and adds the columns the model
  needs on top of the original definition (idempotent — safe to re-run).

  Each ALTER sits in its own batch: SQL Server cannot reference a column it
  added in the same batch.
*/

SET NOCOUNT ON;
GO

/* ---------------------------------------------------------------------------
   1. ProductVariants
--------------------------------------------------------------------------- */

IF OBJECT_ID(N'dbo.ProductVariants', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProductVariants (
        VariantId       UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProductVariants PRIMARY KEY
                        CONSTRAINT DF_ProductVariants_Id DEFAULT (NEWSEQUENTIALID()),
        ProductId       UNIQUEIDENTIFIER NOT NULL,
        Sku             NVARCHAR(64)     NULL,
        VariantName     NVARCHAR(150)    NOT NULL,         -- e.g. "Orange / 128GB"
        AttributesJson  NVARCHAR(MAX)    NULL,             -- {"Color":"Orange","Storage":"128GB"}
        Price           DECIMAL(18,2)    NOT NULL,
        LastCostPrice   DECIMAL(18,2)    NULL,
        AvgCostPrice    DECIMAL(18,2)    NULL,
        StockQuantity   INT              NOT NULL CONSTRAINT DF_Variants_Stock DEFAULT (0),
        IsActive        BIT              NOT NULL CONSTRAINT DF_Variants_IsActive DEFAULT (1),
        CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Variants_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Variants_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_Variants_Products FOREIGN KEY (ProductId)
            REFERENCES dbo.Products (ProductId) ON DELETE CASCADE
    );
    PRINT N'Created dbo.ProductVariants';
END
ELSE
    PRINT N'dbo.ProductVariants already present';
GO

/* SalePrice — a variant discounts on its own, mirroring Products.BasePrice/SalePrice. */
IF COL_LENGTH('dbo.ProductVariants', 'SalePrice') IS NULL
BEGIN
    ALTER TABLE dbo.ProductVariants ADD SalePrice DECIMAL(18,2) NULL;
    PRINT N'Added ProductVariants.SalePrice';
END
GO

/* ReservedQuantity — mirrors Products.ReservedQuantity so availability is per variant. */
IF COL_LENGTH('dbo.ProductVariants', 'ReservedQuantity') IS NULL
BEGIN
    ALTER TABLE dbo.ProductVariants
        ADD ReservedQuantity INT NOT NULL CONSTRAINT DF_Variants_Reserved DEFAULT (0);
    PRINT N'Added ProductVariants.ReservedQuantity';
END
GO

/* SortOrder — the seller decides which variant the buyer lands on first. */
IF COL_LENGTH('dbo.ProductVariants', 'SortOrder') IS NULL
BEGIN
    ALTER TABLE dbo.ProductVariants
        ADD SortOrder INT NOT NULL CONSTRAINT DF_Variants_SortOrder DEFAULT (0);
    PRINT N'Added ProductVariants.SortOrder';
END
GO

/* ImageUrl — picking "Orange" should swap the photo; one URL per variant is enough. */
IF COL_LENGTH('dbo.ProductVariants', 'ImageUrl') IS NULL
BEGIN
    ALTER TABLE dbo.ProductVariants ADD ImageUrl NVARCHAR(512) NULL;
    PRINT N'Added ProductVariants.ImageUrl';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_Variants_Price' AND parent_object_id = OBJECT_ID(N'dbo.ProductVariants')
)
BEGIN
    ALTER TABLE dbo.ProductVariants
        ADD CONSTRAINT CK_Variants_Price
            CHECK (Price >= 0 AND (SalePrice IS NULL OR SalePrice >= 0));
    PRINT N'Added CK_Variants_Price';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_Variants_Stock' AND parent_object_id = OBJECT_ID(N'dbo.ProductVariants')
)
BEGIN
    ALTER TABLE dbo.ProductVariants
        ADD CONSTRAINT CK_Variants_Stock
            CHECK (StockQuantity >= 0 AND ReservedQuantity >= 0);
    PRINT N'Added CK_Variants_Stock';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ProductVariants_ProductId'
      AND object_id = OBJECT_ID(N'dbo.ProductVariants')
)
BEGIN
    CREATE INDEX IX_ProductVariants_ProductId
        ON dbo.ProductVariants (ProductId, SortOrder);
    PRINT N'Created IX_ProductVariants_ProductId';
END
GO

/* A SKU is how a seller identifies one configuration; duplicates inside a
   product make stock counts ambiguous. Filtered so the many NULLs stay legal. */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_ProductVariants_Product_Sku'
      AND object_id = OBJECT_ID(N'dbo.ProductVariants')
)
BEGIN
    CREATE UNIQUE INDEX UQ_ProductVariants_Product_Sku
        ON dbo.ProductVariants (ProductId, Sku)
        WHERE Sku IS NOT NULL;
    PRINT N'Created UQ_ProductVariants_Product_Sku';
END
GO

/* ---------------------------------------------------------------------------
   2. Products — the option axes the variants are built from
--------------------------------------------------------------------------- */

/*
  The variant rows carry the chosen values ({"Color":"Orange"}); this column
  carries the axes themselves, in the order the seller declared them:

    [{"name":"Color","values":["Orange","White"]},
     {"name":"Storage","values":["128GB","256GB"]}]

  Without it the storefront would have to infer the selectors by scanning every
  variant, which loses the ordering and drops any value that is momentarily
  sold out.
*/
IF COL_LENGTH('dbo.Products', 'VariantOptionsJson') IS NULL
BEGIN
    ALTER TABLE dbo.Products ADD VariantOptionsJson NVARCHAR(MAX) NULL;
    PRINT N'Added Products.VariantOptionsJson';
END
GO

/* ---------------------------------------------------------------------------
   3. VariantId on the tables that reference a variant
--------------------------------------------------------------------------- */

IF COL_LENGTH('dbo.InventoryLots', 'VariantId') IS NULL
BEGIN
    ALTER TABLE dbo.InventoryLots ADD VariantId UNIQUEIDENTIFIER NULL;
    PRINT N'Added InventoryLots.VariantId';
END
GO

IF COL_LENGTH('dbo.InventoryTransactions', 'VariantId') IS NULL
BEGIN
    ALTER TABLE dbo.InventoryTransactions ADD VariantId UNIQUEIDENTIFIER NULL;
    PRINT N'Added InventoryTransactions.VariantId';
END
GO

IF COL_LENGTH('dbo.CartItems', 'VariantId') IS NULL
BEGIN
    ALTER TABLE dbo.CartItems ADD VariantId UNIQUEIDENTIFIER NULL;
    PRINT N'Added CartItems.VariantId';
END
GO

IF COL_LENGTH('dbo.OrderItems', 'VariantId') IS NULL
BEGIN
    ALTER TABLE dbo.OrderItems ADD VariantId UNIQUEIDENTIFIER NULL;
    PRINT N'Added OrderItems.VariantId';
END
GO

/* Snapshot the configuration on the order line. Prices and variant names change;
   an invoice must still read "Orange / 128GB" a year later. */
IF COL_LENGTH('dbo.OrderItems', 'VariantNameSnapshot') IS NULL
BEGIN
    ALTER TABLE dbo.OrderItems ADD VariantNameSnapshot NVARCHAR(150) NULL;
    PRINT N'Added OrderItems.VariantNameSnapshot';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_Lots_Variant' AND parent_object_id = OBJECT_ID(N'dbo.InventoryLots')
)
BEGIN
    ALTER TABLE dbo.InventoryLots
        ADD CONSTRAINT FK_Lots_Variant FOREIGN KEY (VariantId)
            REFERENCES dbo.ProductVariants (VariantId);
    PRINT N'Added FK_Lots_Variant';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_CartItems_Variant' AND parent_object_id = OBJECT_ID(N'dbo.CartItems')
)
BEGIN
    ALTER TABLE dbo.CartItems
        ADD CONSTRAINT FK_CartItems_Variant FOREIGN KEY (VariantId)
            REFERENCES dbo.ProductVariants (VariantId);
    PRINT N'Added FK_CartItems_Variant';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_OrderItems_Variant' AND parent_object_id = OBJECT_ID(N'dbo.OrderItems')
)
BEGIN
    ALTER TABLE dbo.OrderItems
        ADD CONSTRAINT FK_OrderItems_Variant FOREIGN KEY (VariantId)
            REFERENCES dbo.ProductVariants (VariantId);
    PRINT N'Added FK_OrderItems_Variant';
END
GO

/* FIFO allocation now narrows by variant, so the index has to as well. */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Lots_Product_Variant_Status_ReceivedAt'
      AND object_id = OBJECT_ID(N'dbo.InventoryLots')
)
BEGIN
    CREATE INDEX IX_Lots_Product_Variant_Status_ReceivedAt
        ON dbo.InventoryLots (ProductId, VariantId, Status, ReceivedAt);
    PRINT N'Created IX_Lots_Product_Variant_Status_ReceivedAt';
END
GO

/*
  One cart line per (cart, product, variant).

  database.sql declares this as a table-level UNIQUE constraint, and a constraint's
  backing index cannot be dropped with DROP INDEX — so the constraint has to be
  dropped as a constraint, and only a standalone index dropped as an index. Both
  forms exist across deployments, so both are handled, constraint first.
*/
IF EXISTS (
    SELECT 1 FROM sys.key_constraints
    WHERE name = N'UQ_CartItems_Cart_Product_Variant'
      AND parent_object_id = OBJECT_ID(N'dbo.CartItems')
)
BEGIN
    ALTER TABLE dbo.CartItems DROP CONSTRAINT UQ_CartItems_Cart_Product_Variant;
    PRINT N'Dropped UQ_CartItems_Cart_Product_Variant (constraint)';
END
GO

IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_CartItems_Cart_Product_Variant'
      AND object_id = OBJECT_ID(N'dbo.CartItems')
)
BEGIN
    DROP INDEX UQ_CartItems_Cart_Product_Variant ON dbo.CartItems;
    PRINT N'Dropped UQ_CartItems_Cart_Product_Variant (index)';
END
GO

/*
  Recreated as a plain unique index, which is what EF's HasIndex().IsUnique() expects.

  UNIQUE over a nullable column treats every NULL as distinct in most engines, but SQL
  Server treats them as equal — which is what we want here: a product with no variants
  must still be limited to one cart line.
*/
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_CartItems_Cart_Product_Variant'
      AND object_id = OBJECT_ID(N'dbo.CartItems')
)
BEGIN
    CREATE UNIQUE INDEX UQ_CartItems_Cart_Product_Variant
        ON dbo.CartItems (CartId, ProductId, VariantId);
    PRINT N'Created UQ_CartItems_Cart_Product_Variant';
END
GO

/* ---------------------------------------------------------------------------
   4. No backfill

   Variants are optional. A product with zero variants keeps behaving exactly
   as before: price from Products.BasePrice/SalePrice, stock from
   Products.StockQuantity, cart and order lines with VariantId NULL. Only once
   a seller adds variants do Products.BasePrice and Products.StockQuantity
   become rollups (cheapest variant / summed stock) maintained by the API.

   That is why every existing row is left untouched here.
--------------------------------------------------------------------------- */

PRINT N'--- product-variants-schema.sql complete ---';
GO

SELECT
    (SELECT COUNT(*) FROM dbo.ProductVariants)                              AS VariantCount,
    (SELECT COUNT(*) FROM dbo.Products WHERE VariantOptionsJson IS NOT NULL) AS ProductsWithOptions,
    (SELECT COUNT(*) FROM dbo.InventoryLots WHERE VariantId IS NOT NULL)     AS VariantScopedLots;
GO

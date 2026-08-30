/*
  shipping-schema.sql — automatic order fulfillment via a carrier.

  See docs/solution-auto-fulfillment-shipping.md.

  A paid order gets a shipment created with GHN. From then on the carrier drives
  the order status: Confirmed when the shipment exists, Shipping when it is
  picked up, Delivered when it lands. The seller can still push the status by
  hand at any time; both paths only move forward.

  ShipmentEvents is append-only and carries the idempotency key, so a webhook
  delivered three times still moves the order once.

  Safe to re-run.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* -------------------------------------------------------------------------- */
/* 1. Shipments — one row per order                                            */
/* -------------------------------------------------------------------------- */

IF OBJECT_ID('dbo.Shipments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Shipments (
        ShipmentId         UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Shipments PRIMARY KEY
                           CONSTRAINT DF_Shipments_Id DEFAULT (NEWSEQUENTIALID()),
        OrderId            UNIQUEIDENTIFIER NOT NULL,
        Provider           NVARCHAR(20)     NOT NULL,   -- GHN (snapshot; a second carrier may be added later)
        ProviderShipmentId NVARCHAR(60)     NULL,       -- carrier order code, NULL until created
        TrackingCode       NVARCHAR(100)    NULL,       -- what the buyer sees
        Status             NVARCHAR(20)     NOT NULL CONSTRAINT DF_Shipments_Status DEFAULT (N'Pending'),
            -- Pending | Created | PickedUp | InTransit | Delivered | Failed | Returned | Cancelled
        ProviderStatus     NVARCHAR(60)     NULL,       -- raw carrier string, for debugging
        ShippingFeeQuoted  DECIMAL(18,2)    NULL,
        ExpectedDeliveryAt DATETIME2(3)     NULL,
        NextActionAt       DATETIME2(3)     NULL,       -- when the poller should ask GHN again
        LastSyncedAt       DATETIME2(3)     NULL,
        AttemptCount       INT              NOT NULL CONSTRAINT DF_Shipments_Attempts DEFAULT (0),
        LastError          NVARCHAR(500)    NULL,
        RawCreateJson      NVARCHAR(MAX)    NULL,
        CreatedAt          DATETIME2(3)     NOT NULL CONSTRAINT DF_Shipments_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt          DATETIME2(3)     NOT NULL CONSTRAINT DF_Shipments_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_Shipments_Order FOREIGN KEY (OrderId) REFERENCES dbo.Orders (OrderId),
        CONSTRAINT CK_Shipments_Status CHECK (Status IN (
            N'Pending', N'Created', N'PickedUp', N'InTransit',
            N'Delivered', N'Failed', N'Returned', N'Cancelled'))
    );

    -- One order, one shipment. This is what stops two job ticks dispatching twice.
    CREATE UNIQUE INDEX UX_Shipments_Order ON dbo.Shipments (OrderId);
    CREATE INDEX IX_Shipments_Provider_ShipmentId ON dbo.Shipments (Provider, ProviderShipmentId);
    CREATE INDEX IX_Shipments_Status_NextAction ON dbo.Shipments (Status, NextActionAt);
    PRINT N'Created dbo.Shipments';
END;
GO

/* -------------------------------------------------------------------------- */
/* 2. ShipmentEvents — append-only carrier events                              */
/* -------------------------------------------------------------------------- */

IF OBJECT_ID('dbo.ShipmentEvents', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ShipmentEvents (
        ShipmentEventId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ShipmentEvents PRIMARY KEY
                        CONSTRAINT DF_ShipmentEvents_Id DEFAULT (NEWSEQUENTIALID()),
        ShipmentId      UNIQUEIDENTIFIER NOT NULL,
        /* Idempotency key. Carrier event id when it sends one, otherwise a
           deterministic hash of (status + occurredAt) so replays collide. */
        ExternalEventId NVARCHAR(120)    NOT NULL,
        ProviderStatus  NVARCHAR(60)     NOT NULL,
        MappedStatus    NVARCHAR(20)     NOT NULL,
        Description     NVARCHAR(300)    NULL,
        Source          NVARCHAR(20)     NOT NULL,   -- Webhook | Poll | Dispatch | Manual
        AppliedToOrder  BIT              NOT NULL CONSTRAINT DF_ShipmentEvents_Applied DEFAULT (0),
        OccurredAt      DATETIME2(3)     NOT NULL,
        ReceivedAt      DATETIME2(3)     NOT NULL CONSTRAINT DF_ShipmentEvents_ReceivedAt DEFAULT (SYSUTCDATETIME()),
        RawJson         NVARCHAR(MAX)    NULL,
        CONSTRAINT FK_ShipmentEvents_Shipment FOREIGN KEY (ShipmentId)
            REFERENCES dbo.Shipments (ShipmentId) ON DELETE CASCADE,
        CONSTRAINT CK_ShipmentEvents_Source CHECK (Source IN (N'Webhook', N'Poll', N'Dispatch', N'Manual'))
    );

    -- The webhook can be delivered any number of times; the DB decides it is one event.
    CREATE UNIQUE INDEX UX_ShipmentEvents_External ON dbo.ShipmentEvents (ShipmentId, ExternalEventId);
    CREATE INDEX IX_ShipmentEvents_Shipment_Occurred ON dbo.ShipmentEvents (ShipmentId, OccurredAt);
    PRINT N'Created dbo.ShipmentEvents';
END;
GO

/* -------------------------------------------------------------------------- */
/* 3. Migrate an earlier install that still allows the 'Simulator' source       */
/* -------------------------------------------------------------------------- */

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_ShipmentEvents_Source'
      AND definition LIKE '%Simulator%'
)
BEGIN
    UPDATE dbo.ShipmentEvents SET Source = N'Dispatch' WHERE Source = N'Simulator';
    ALTER TABLE dbo.ShipmentEvents DROP CONSTRAINT CK_ShipmentEvents_Source;
    ALTER TABLE dbo.ShipmentEvents ADD CONSTRAINT CK_ShipmentEvents_Source
        CHECK (Source IN (N'Webhook', N'Poll', N'Dispatch', N'Manual'));
    PRINT N'Replaced CK_ShipmentEvents_Source (Simulator -> Dispatch)';
END;
GO

PRINT N'shipping-schema.sql completed.';
GO

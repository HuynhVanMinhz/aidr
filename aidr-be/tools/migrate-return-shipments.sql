-- Migration: Return Shipment tables
-- Adds GHN reverse-shipment tracking for the return/refund flow.

CREATE TABLE ReturnShipments (
    ReturnShipmentId    UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    ReturnRequestId     UNIQUEIDENTIFIER NOT NULL,
    Provider            NVARCHAR(20)     NOT NULL,
    ProviderShipmentId  NVARCHAR(60)     NULL,
    TrackingCode        NVARCHAR(60)     NULL,
    Status              NVARCHAR(30)     NOT NULL,
    ProviderStatus      NVARCHAR(60)     NULL,
    ShippingFeeQuoted   DECIMAL(12, 2)   NULL,
    ExpectedDeliveryAt  DATETIME2        NULL,
    AttemptCount        INT              NOT NULL DEFAULT 0,
    LastError           NVARCHAR(500)    NULL,
    RawCreateJson       NVARCHAR(MAX)    NULL,
    CreatedAt           DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt           DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_ReturnShipments_ReturnRequest
        FOREIGN KEY (ReturnRequestId)
        REFERENCES ReturnRequests (ReturnRequestId)
        ON DELETE CASCADE
);

CREATE INDEX IX_ReturnShipments_ReturnRequestId ON ReturnShipments (ReturnRequestId);
CREATE INDEX IX_ReturnShipments_ProviderShipmentId ON ReturnShipments (ProviderShipmentId);

-- -----------------------------------------------------------------------

CREATE TABLE ReturnShipmentEvents (
    ReturnShipmentEventId   UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    ReturnShipmentId        UNIQUEIDENTIFIER NOT NULL,
    ExternalEventId         NVARCHAR(120)    NOT NULL,
    ProviderStatus          NVARCHAR(60)     NOT NULL,
    MappedStatus            NVARCHAR(30)     NOT NULL,
    Description             NVARCHAR(300)    NULL,
    Source                  NVARCHAR(20)     NOT NULL,
    AppliedToReturn         BIT              NOT NULL DEFAULT 0,
    OccurredAt              DATETIME2        NOT NULL,
    ReceivedAt              DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    RawJson                 NVARCHAR(MAX)    NULL,

    CONSTRAINT FK_ReturnShipmentEvents_ReturnShipment
        FOREIGN KEY (ReturnShipmentId)
        REFERENCES ReturnShipments (ReturnShipmentId)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX UX_ReturnShipmentEvents_IdempotencyKey
    ON ReturnShipmentEvents (ReturnShipmentId, ExternalEventId);

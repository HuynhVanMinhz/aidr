/*
  address-geo-schema.sql - map coordinates for the two ends of a delivery.

  See docs/solution-auto-fulfillment-shipping.md §13.

  The buyer already pins the delivery point on a map when saving an address, and
  the seller pins the pickup point in Shop settings. Those coordinates are what
  the order tracking map draws; the carrier only ever reports a status string, so
  without them there is nothing to put on a map.

  Both columns are nullable: every address and shop that predates this script
  keeps working, it just has no pin yet.

  Safe to re-run.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* -------------------------------------------------------------------------- */
/* 1. Addresses - the delivery point the buyer pinned                          */
/* -------------------------------------------------------------------------- */

IF COL_LENGTH('dbo.Addresses', 'Latitude') IS NULL
    ALTER TABLE dbo.Addresses ADD Latitude FLOAT NULL;

IF COL_LENGTH('dbo.Addresses', 'Longitude') IS NULL
    ALTER TABLE dbo.Addresses ADD Longitude FLOAT NULL;

/* -------------------------------------------------------------------------- */
/* 2. Shops - the pickup point the carrier collects from                       */
/* -------------------------------------------------------------------------- */

IF COL_LENGTH('dbo.Shops', 'Latitude') IS NULL
    ALTER TABLE dbo.Shops ADD Latitude FLOAT NULL;

IF COL_LENGTH('dbo.Shops', 'Longitude') IS NULL
    ALTER TABLE dbo.Shops ADD Longitude FLOAT NULL;

PRINT 'address-geo-schema.sql applied.';

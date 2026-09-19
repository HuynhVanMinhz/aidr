/*
  seed-data-table-counts.sql - row count snapshot for every user table in AIDR.
  Includes optional tables (Settlement, Shipping, KYC) when they exist.
*/
SET NOCOUNT ON;

SELECT
    t.name AS TableName,
    [Rows] = SUM(CASE WHEN p.index_id IN (0, 1) THEN p.rows ELSE 0 END)
FROM sys.tables t
INNER JOIN sys.partitions p ON t.object_id = p.object_id
WHERE t.is_ms_shipped = 0
  AND t.name NOT LIKE N'#%'
GROUP BY t.name
ORDER BY t.name;

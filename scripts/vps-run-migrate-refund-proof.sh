#!/usr/bin/env bash
# Run on VPS: bash /opt/aidr/scripts/vps-run-migrate-refund-proof.sh
# Prerequisites: aidr-sqlserver up, /opt/aidr/.env has MSSQL_SA_PASSWORD,
#                SQL file at /opt/aidr/scripts/add-return-refund-proof-columns.sql
set -euo pipefail
cd /opt/aidr
set -a
# shellcheck disable=SC1091
source .env
set +a

SQL_SRC="/opt/aidr/scripts/add-return-refund-proof-columns.sql"
if [[ ! -f "$SQL_SRC" ]]; then
  echo "Missing $SQL_SRC" >&2
  exit 1
fi

docker cp "$SQL_SRC" aidr-sqlserver:/tmp/add-return-refund-proof-columns.sql

docker exec aidr-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -d AIDR \
  -i /tmp/add-return-refund-proof-columns.sql

docker exec aidr-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -d AIDR \
  -Q "SELECT c.name AS ColumnName, t.name AS TableName
      FROM sys.columns c
      INNER JOIN sys.tables t ON c.object_id = t.object_id
      WHERE (t.name = N'ReturnRequests' AND c.name = N'RefundTransferProofUrl')
         OR (t.name = N'Notifications' AND c.name = N'ImageUrl')
      ORDER BY t.name, c.name;"

echo MIGRATE_REFUND_PROOF_OK

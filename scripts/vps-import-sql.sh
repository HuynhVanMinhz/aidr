#!/bin/bash
set -euo pipefail
cd /opt/aidr
# shellcheck disable=SC1091
set -a
source .env
set +a

echo "Copying SQL into container..."
docker cp /opt/aidr/data-new.linux.sql aidr-sqlserver:/tmp/data-new.linux.sql

echo "Importing (may take several minutes)..."
docker exec aidr-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C \
  -i /tmp/data-new.linux.sql

echo "Databases:"
docker exec aidr-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C \
  -Q "SELECT name FROM sys.databases ORDER BY name"
echo IMPORT_DONE

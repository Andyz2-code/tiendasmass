#!/usr/bin/env bash
set -e

PORT="${PORT:-80}"
sed -i "s/Listen 80/Listen ${PORT}/g" /etc/apache2/ports.conf
sed -i "s/:80>/:${PORT}>/g" /etc/apache2/sites-available/000-default.conf

DB_HOST_VAL="${DB_HOST:-${MYSQLHOST:-}}"
DB_PORT_VAL="${DB_PORT:-${MYSQLPORT:-3306}}"
DB_USER_VAL="${DB_USERNAME:-${MYSQLUSER:-root}}"
DB_PASS_VAL="${DB_PASSWORD:-${MYSQLPASSWORD:-}}"
DB_NAME_VAL="${DB_DATABASE:-${MYSQLDATABASE:-railway}}"

MYSQL_FLAGS="-h ${DB_HOST_VAL} -P ${DB_PORT_VAL} -u ${DB_USER_VAL} -p${DB_PASS_VAL} --skip-ssl"

if [ -n "$DB_HOST_VAL" ]; then
  echo "[TiendasMass] Esperando conexión a MySQL en ${DB_HOST_VAL}:${DB_PORT_VAL}..."
  for i in $(seq 1 30); do
    if mysql $MYSQL_FLAGS -e "SELECT 1" "$DB_NAME_VAL" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  HAS_TABLE=$(mysql $MYSQL_FLAGS -N -s -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME_VAL}' AND table_name='productos';" 2>/dev/null || echo "0")
  if [ "$HAS_TABLE" = "0" ]; then
    echo "[TiendasMass] Inicializando base de datos y migraciones en ${DB_NAME_VAL}..."
    mysql $MYSQL_FLAGS < /var/www/html/database/tiendas_mass.sql
    for mig in 03_create_banners_table.sql 06_update_real_product_images.sql 07_add_more_products_with_real_images.sql 08_arkan_modules.sql; do
      if [ -f "/var/www/html/database/migrations/$mig" ]; then
        mysql $MYSQL_FLAGS "$DB_NAME_VAL" < "/var/www/html/database/migrations/$mig" || true
      fi
    done
    echo "[TiendasMass] Base de datos inicializada correctamente."
  fi
fi

exec apache2-foreground

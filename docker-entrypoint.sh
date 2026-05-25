#!/bin/sh
set -e

cd /app/server
npx prisma migrate deploy

exec "$@"

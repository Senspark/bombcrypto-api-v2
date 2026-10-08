#!/bin/sh
# Renders the crontab from NATIVE_RATE_CRON, then hands over to crond.
set -e

CRON="${NATIVE_RATE_CRON:-0 23 * * *}"

if [ "$(echo "$CRON" | wc -w)" -ne 5 ]; then
    echo "NATIVE_RATE_CRON must have exactly 5 fields, got: $CRON" >&2
    exit 1
fi

sed "s|@NATIVE_RATE_CRON@|$CRON|" /app/crontab.template > /etc/crontabs/root

echo "native-rate-keeper scheduled: $CRON (container clock is UTC)"
cat /etc/crontabs/root

exec crond -f -l 8

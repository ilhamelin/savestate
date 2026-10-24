#!/usr/bin/env bash
# Disposable PostgreSQL fixture only. Start an older transaction that reaches the IP lock later.
set -euo pipefail
psql -h 127.0.0.1 -U postgres -d soc_test -v ON_ERROR_STOP=1 -c "begin; select pg_sleep(1); select public.guardian_soc_fail('192.0.2.44','Concurrent late transaction'); commit;" > /tmp/spec12-late.log &
late=$!
sleep 0.3
psql -h 127.0.0.1 -U postgres -d soc_test -v ON_ERROR_STOP=1 -c "select public.guardian_soc_fail('192.0.2.44','Concurrent early lock');"
wait "$late"
count=$(psql -h 127.0.0.1 -U postgres -d soc_test -tA -c "select cardinality(attempts) from public.guardian_threat_ips where ip='192.0.2.44';")
test "$count" = 2
for n in 1 2 3; do
  psql -h 127.0.0.1 -U postgres -d soc_test -v ON_ERROR_STOP=1 -c "select public.guardian_soc_fail('192.0.2.44','Parallel threshold');" > "/tmp/spec12-parallel-$n.log" &
done
wait
count=$(psql -h 127.0.0.1 -U postgres -d soc_test -tA -c "select count(*) from public.guardian_threat_ips where ip='192.0.2.44' and cardinality(attempts)=5 and expires_at>now();")
test "$count" = 1
echo 'PASS: reordered transactions retain both attempts; concurrent failures trigger exactly one quarantine.'

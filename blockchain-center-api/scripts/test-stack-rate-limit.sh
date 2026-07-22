#!/usr/bin/env bash
# Spam an RPC over IPv4 until rate-limited, then switch to IPv6.
# If IPv6 starts fresh -> IPv4 and IPv6 are separate buckets (use both for 2x).
# If IPv6 is already limited -> shared bucket.
#
# Usage: ./test-stack-rate-limit.sh [RPC_URL] [MAX_REQUESTS] [IFACE]
#   - IFACE optional: omit to let OS pick (works on Mac). Set to e.g. enp3s0 on Linux server.

set -o pipefail

RPC_URL="${1:-https://bsc-dataseed.binance.org/}"
MAX_REQUESTS="${2:-2000}"
IFACE="${3:-}"
SWITCH_AFTER_LIMITS=5

PAYLOAD='{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

iface_arg=()
[[ -n "$IFACE" ]] && iface_arg=(--interface "$IFACE")

echo "=== Detecting public IPs ==="
IPV4=$(curl -s -4 "${iface_arg[@]}" --max-time 5 https://api.ipify.org 2>/dev/null || true)
IPV6=$(curl -s -6 "${iface_arg[@]}" --max-time 5 https://api64.ipify.org 2>/dev/null || true)
echo "  Public IPv4 : ${IPV4:-UNAVAILABLE}"
echo "  Public IPv6 : ${IPV6:-UNAVAILABLE}"

if [[ -z "$IPV4" ]]; then
  echo "Error: no IPv4 egress. Cannot run test."
  exit 1
fi
if [[ -z "$IPV6" ]]; then
  echo "Error: no IPv6 egress. Cannot run test."
  exit 1
fi

probe() {
  local stack="$1"
  local out code body
  out=$(curl -s "${iface_arg[@]}" "$stack" --max-time 5 \
        -w "\n__HTTP__:%{http_code}" \
        -X POST "$RPC_URL" \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD" 2>&1)
  code=$(echo "$out" | grep -oE '__HTTP__:[0-9]+' | cut -d: -f2)
  body=$(echo "$out" | grep -v '__HTTP__:')

  if [[ "$code" == "429" ]]; then
    echo "limited"
  elif [[ "$code" == "200" ]]; then
    if echo "$body" | grep -qiE '"error".*(limit|rate|exceeded|too many|throttl)'; then
      echo "limited"
    else
      echo "ok"
    fi
  else
    echo "err:${code:-0}"
  fi
}

phase() {
  local stack="$1"
  local label="$2"
  local ok=0 lim=0 err=0 consec=0 total=0
  local t0
  t0=$(date +%s)

  echo ""
  echo "=== Phase: $label (curl $stack -> $RPC_URL) ==="

  while ((total < MAX_REQUESTS)); do
    local r
    r=$(probe "$stack")
    total=$((total+1))
    case "$r" in
      ok)       ok=$((ok+1));   consec=0 ;;
      limited)  lim=$((lim+1)); consec=$((consec+1)) ;;
      *)        err=$((err+1)); consec=0 ;;
    esac

    if (( total % 10 == 0 )); then
      printf "  [%s] req=%d ok=%d limited=%d err=%d consec_limit=%d elapsed=%ds\n" \
        "$label" "$total" "$ok" "$lim" "$err" "$consec" "$(( $(date +%s) - t0 ))"
    fi

    if (( consec >= SWITCH_AFTER_LIMITS )); then
      echo "  -> $consec consecutive rate-limit responses, stopping phase"
      break
    fi
  done

  echo "  [$label] TOTAL: req=$total ok=$ok limited=$lim err=$err"
  (( consec >= SWITCH_AFTER_LIMITS ))
}

echo ""
echo "Target RPC : $RPC_URL"
[[ -n "$IFACE" ]] && echo "Interface  : $IFACE"
echo "Switch after $SWITCH_AFTER_LIMITS consecutive limits (max $MAX_REQUESTS req/phase)"

if phase "-4" "IPv4"; then
  echo ""
  echo "-> IPv4 hit rate limit. Switching to IPv6 immediately..."
  phase "-6" "IPv6"

  echo ""
  echo "=== INTERPRETATION ==="
  echo "  IPv6 ran mostly 'ok' before any limit  -> SEPARATE buckets (use both stacks for 2x)"
  echo "  IPv6 hit consec_limit within ~5 req    -> SHARED bucket"
else
  echo ""
  echo "-> Did not hit rate limit on IPv4 after $MAX_REQUESTS requests."
  echo "   Try a stricter RPC, or raise MAX_REQUESTS."
fi

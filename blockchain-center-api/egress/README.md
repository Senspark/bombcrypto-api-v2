# Multi-egress for blockchain-center-api

Route RPC calls out through more than one public IP (one per NIC/ISP) to multiply
the per-IP rate-limit budget at public RPC providers.

## How it works

- The app keeps running as a **single container on the normal bridge network**
  (service name, Redis service name, and the dashboard all unchanged).
- Egress IP selection is delegated to small **tinyproxy** containers — one per
  egress IP — that run with `network_mode: host` and `Bind` their outgoing
  socket to a specific LAN IP.
- The app reads `EGRESS_PROXIES` (comma-separated proxy URLs) and round-robins
  each RPC call through one of the proxies via an HTTP CONNECT tunnel
  (`https-proxy-agent`). TLS stays end-to-end app↔RPC; the proxy only relays
  bytes and sets the source IP. Provider sees a different public IP per proxy.
- If `EGRESS_PROXIES` is empty → direct egress (default NIC), i.e. local-dev
  behavior is unchanged.

## Prerequisite: host source-based policy routing

`Bind <LAN IP>` only egresses out the matching NIC if the host has source-based
policy routing for that IP. See the server runbook
`senspark/multi_nic_rpc_egress.md`. Without it, both proxies leave via the
default NIC and the boot self-check will report the **same** public IP for both
(visible on `/status` and in logs) — it fails loudly, not silently.

## App env vars

| Var | Example | Meaning |
|-----|---------|---------|
| `EGRESS_PROXIES` | `http://host.docker.internal:8881,http://host.docker.internal:8882` | Proxy URLs, one per egress IP. Empty = direct. |
| `EGRESS_EXPECTED_IPS` | `203.0.113.10,203.0.113.20` | (optional) Expected public IP per proxy, same order. Boot check flags mismatch. |

The app probes each proxy once at startup (`api.ipify.org`) and logs
`[egress] <proxy> -> <publicIp> [ok|MISMATCH|FAIL]`; the result is also on
`/status` → `egress` and shown on the dashboard.

## Compose snippet (production)

```yaml
  prod-ap-egress-proxy-1:
    image: vimagick/tinyproxy
    container_name: prod-ap-egress-proxy-1
    network_mode: host
    volumes:
      - ./egress/tinyproxy-1.conf:/etc/tinyproxy/tinyproxy.conf:ro  # Port 8881, Bind 10.0.0.101
    restart: unless-stopped

  prod-ap-egress-proxy-2:
    image: vimagick/tinyproxy
    container_name: prod-ap-egress-proxy-2
    network_mode: host
    volumes:
      - ./egress/tinyproxy-2.conf:/etc/tinyproxy/tinyproxy.conf:ro  # Port 8882, Bind 10.0.0.102
    restart: unless-stopped

  prod-ap-blockchain-center:        # unchanged networking — stays on bc-prod
    # ...existing config...
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      EGRESS_PROXIES: 'http://host.docker.internal:8881,http://host.docker.internal:8882'
      EGRESS_EXPECTED_IPS: '203.0.113.10,203.0.113.20'
```

## Verify after deploy

```bash
curl -s http://<host>:9045/status | jq .egress
# mode: "proxy", targets[].publicIp should be the two distinct egress IPs, ok: true
```

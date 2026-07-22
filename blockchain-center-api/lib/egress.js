import https from "https";
import { HttpsProxyAgent } from "https-proxy-agent";

// EGRESS_PROXIES = comma-separated proxy URLs, one per egress IP. Example:
//   "http://172.18.0.1:8881,http://172.18.0.1:8882"
// Each proxy (tinyproxy) binds its outgoing connection to a specific source IP,
// so routing each RPC call through a different proxy = a different public egress
// IP = a separate rate-limit bucket at the provider.
// Empty/unset => direct egress (no proxy), preserving local-dev behavior.
const proxyUrls = (process.env.EGRESS_PROXIES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Optional, same order as EGRESS_PROXIES — the public IP each proxy is expected
// to egress from. Used only to flag misconfiguration in the boot self-check.
const expectedIps = (process.env.EGRESS_EXPECTED_IPS || "")
  .split(",")
  .map((s) => s.trim());

const targets = proxyUrls.map((url, i) => ({
  url,
  agent: new HttpsProxyAgent(url, { keepAlive: true }),
  expected: expectedIps[i] || null,
  publicIp: null,
  ok: null,
}));

// Direct egress (agent null => ethers opens the connection itself, default NIC).
const DIRECT = { url: "direct", agent: null, expected: null, publicIp: null, ok: true };

let rr = 0;

// Round-robin over egress targets. Prefer targets that passed the boot check;
// if every proxy failed, degrade to direct egress instead of an outage.
function nextEgress() {
  if (targets.length === 0) return DIRECT;
  const healthy = targets.filter((t) => t.ok !== false);
  const pool = healthy.length ? healthy : [DIRECT];
  return pool[rr++ % pool.length];
}

function httpsGet(url, agent, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
  });
}

// One-shot at startup: probe each proxy's actual public egress IP so misrouting
// (e.g. missing policy routing => both proxies leave via the same NIC) is visible
// in logs and on /status instead of failing silently.
async function runEgressCheck() {
  if (targets.length === 0) {
    console.log("[egress] no EGRESS_PROXIES set — direct egress");
    return;
  }
  await Promise.all(
    targets.map(async (t) => {
      try {
        t.publicIp = (await httpsGet("https://api.ipify.org", t.agent)).trim();
        t.ok = !t.expected || t.publicIp === t.expected;
      } catch (e) {
        t.publicIp = null;
        t.ok = false;
        console.warn(`[egress] probe failed for ${t.url}: ${e.message}`);
      }
    })
  );
  for (const t of targets) {
    const tag = t.ok ? "ok" : t.expected && t.publicIp ? `MISMATCH expected ${t.expected}` : "FAIL";
    console.log(`[egress] ${t.url} -> ${t.publicIp || "?"} [${tag}]`);
  }
}

function getEgressStatus() {
  return {
    mode: targets.length ? "proxy" : "direct",
    targets: targets.map((t) => ({
      url: t.url,
      publicIp: t.publicIp,
      expected: t.expected,
      ok: t.ok,
    })),
  };
}

export { nextEgress, runEgressCheck, getEgressStatus };

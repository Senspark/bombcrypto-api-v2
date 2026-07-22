#!/usr/bin/env node
/**
 * test-rpcs.js — probe a list of RPC endpoints for reliability.
 *
 * For each RPC, runs:
 *   1. eth_chainId                     — health + chain identity
 *   2. getTokenDetailsByOwner × N      — checks self-consistency (same RPC, repeated calls)
 *   3. eth_getLogs over recent blocks  — checks getLogs support
 *
 * Then cross-compares the getTokenDetailsByOwner counts across RPCs and flags any
 * outliers vs. the majority count (treated as ground truth).
 *
 * Usage:
 *   node scripts/test-rpcs.js
 *   node scripts/test-rpcs.js --runs 3 --owner 0x... --contract 0x...
 */

import { JsonRpcProvider, Contract, Interface } from "ethers";

// ---------- defaults (edit RPCS to add/remove endpoints) ----------

const DEFAULTS = {
  // BSC testnet by default; override via --contract / --owner
  contract: "0xC1A4C06426B4Df799E455964A20FDe866E86fbd1",
  owner: "0xd3a835da3fb6088623e76830b393c1e462e59fa9",
  runs: 5,
  timeoutMs: 20000,
  logsBlocks: 100,        // window for getLogs test
  expectedChainId: 97,    // BSC testnet (chapel)
};

const RPCS = [
  "https://api.zan.top/bsc-testnet"
];

const ABI = [{
  inputs: [{ internalType: "address", name: "owner", type: "address" }],
  name: "getTokenDetailsByOwner",
  outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
  stateMutability: "view",
  type: "function",
}];

// ERC721 Transfer(address,address,uint256) — used for getLogs test
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// ---------- arg parsing ----------

const args = parseArgs(process.argv.slice(2));
const config = {
  contract: args.contract || DEFAULTS.contract,
  owner: args.owner || DEFAULTS.owner,
  runs: parseInt(args.runs || DEFAULTS.runs, 10),
  timeoutMs: parseInt(args.timeout || DEFAULTS.timeoutMs, 10),
  logsBlocks: parseInt(args["logs-blocks"] || DEFAULTS.logsBlocks, 10),
  expectedChainId: parseInt(args["chain-id"] || DEFAULTS.expectedChainId, 10),
};

console.log("Config:", config);
console.log(`RPCs to test: ${RPCS.length}`);
console.log("");

// ---------- helpers ----------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true;
      out[key] = val;
      if (val !== true) i++;
    }
  }
  return out;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timeout after ${ms}ms`)), ms)),
  ]);
}

function fmtMs(ms) {
  return `${ms}ms`.padStart(8);
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function shortRpc(url) {
  // Strip query/path so the table fits
  return url.replace(/\/[^/]{20,}.*$/, "/...").slice(0, 55);
}

// ---------- per-RPC probes ----------

async function probeChainId(provider) {
  const t0 = Date.now();
  const network = await provider.getNetwork();
  return { ok: true, chainId: Number(network.chainId), latency: Date.now() - t0 };
}

async function probeCallContract(provider, runs, contract, owner) {
  const c = new Contract(contract, ABI, provider);
  const counts = [];
  const latencies = [];
  for (let i = 0; i < runs; i++) {
    const t0 = Date.now();
    const result = await c.getTokenDetailsByOwner(owner);
    latencies.push(Date.now() - t0);
    counts.push(result.length);
  }
  const allSame = counts.every(c => c === counts[0]);
  return {
    counts,
    allSame,
    avgLatency: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    minCount: Math.min(...counts),
    maxCount: Math.max(...counts),
  };
}

async function probeGetLogs(provider, contract, blocks) {
  const t0 = Date.now();
  const latest = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - blocks);
  const logs = await provider.getLogs({
    address: contract,
    topics: [TRANSFER_TOPIC],
    fromBlock,
    toBlock: latest,
  });
  return {
    ok: true,
    count: logs.length,
    range: `${fromBlock}-${latest}`,
    latency: Date.now() - t0,
  };
}

async function testRpc(rpcUrl) {
  const provider = new JsonRpcProvider(rpcUrl);
  const result = { rpc: rpcUrl };

  // 1. chainId
  try {
    result.chain = await withTimeout(probeChainId(provider), config.timeoutMs, "chainId");
    if (result.chain.chainId !== config.expectedChainId) {
      result.chain.warn = `expected ${config.expectedChainId} got ${result.chain.chainId}`;
    }
  } catch (e) {
    result.chain = { ok: false, error: e.message };
    return result; // skip rest if RPC unreachable
  }

  // 2. callContract consistency
  try {
    result.call = await withTimeout(
      probeCallContract(provider, config.runs, config.contract, config.owner),
      config.timeoutMs * config.runs,
      "callContract"
    );
  } catch (e) {
    result.call = { ok: false, error: e.message };
  }

  // 3. getLogs
  try {
    result.logs = await withTimeout(
      probeGetLogs(provider, config.contract, config.logsBlocks),
      config.timeoutMs,
      "getLogs"
    );
  } catch (e) {
    result.logs = { ok: false, error: e.message };
  }

  return result;
}

// ---------- main ----------

async function main() {
  const results = [];
  for (const rpc of RPCS) {
    process.stdout.write(`Testing ${shortRpc(rpc)}... `);
    const start = Date.now();
    const r = await testRpc(rpc);
    console.log(`done in ${Date.now() - start}ms`);
    results.push(r);
  }

  // Cross-RPC consensus on count
  const validCounts = results
    .filter(r => r.call && r.call.allSame && r.chain && r.chain.ok && (!r.chain.warn))
    .map(r => r.call.counts[0]);
  const countFreq = new Map();
  for (const c of validCounts) countFreq.set(c, (countFreq.get(c) || 0) + 1);
  const truth = [...countFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  console.log("\n=== Per-RPC results ===\n");
  console.log(
    pad("RPC", 56) +
    pad("chain", 10) +
    pad("count", 14) +
    pad("self?", 7) +
    pad("vs.truth", 12) +
    pad("call(avg)", 11) +
    pad("logs", 10) +
    pad("logs(ms)", 10)
  );
  console.log("-".repeat(120));
  for (const r of results) {
    const chainStr = r.chain.ok
      ? r.chain.warn ? `WRONG(${r.chain.chainId})` : String(r.chain.chainId)
      : "DOWN";
    let countStr = "-";
    let selfStr = "-";
    let truthStr = "-";
    let callLat = "-";
    if (r.call) {
      if (r.call.error) {
        countStr = "ERR";
      } else {
        countStr = r.call.minCount === r.call.maxCount
          ? String(r.call.minCount)
          : `${r.call.minCount}..${r.call.maxCount}`;
        selfStr = r.call.allSame ? "yes" : "NO";
        if (truth != null && r.call.allSame) {
          truthStr = r.call.counts[0] === truth ? "match" : `DIFF(${r.call.counts[0] - truth})`;
        }
        callLat = fmtMs(r.call.avgLatency);
      }
    }
    let logsStr = "-";
    let logsLat = "-";
    if (r.logs) {
      if (r.logs.ok) {
        logsStr = `OK(${r.logs.count})`;
        logsLat = fmtMs(r.logs.latency);
      } else {
        logsStr = "ERR";
      }
    }
    console.log(
      pad(shortRpc(r.rpc), 56) +
      pad(chainStr, 10) +
      pad(countStr, 14) +
      pad(selfStr, 7) +
      pad(truthStr, 12) +
      pad(callLat, 11) +
      pad(logsStr, 10) +
      pad(logsLat, 10)
    );
  }

  // Errors detail
  console.log("\n=== Errors / warnings ===\n");
  for (const r of results) {
    const errs = [];
    if (!r.chain?.ok) errs.push(`chain: ${r.chain?.error}`);
    if (r.chain?.warn) errs.push(`chain: ${r.chain.warn}`);
    if (r.call?.error) errs.push(`call: ${r.call.error}`);
    if (r.logs && !r.logs.ok) errs.push(`logs: ${r.logs.error}`);
    if (errs.length) {
      console.log(`${r.rpc}`);
      for (const e of errs) console.log(`  - ${e}`);
    }
  }

  // Verdict
  console.log("\n=== Verdict ===\n");
  if (truth == null) {
    console.log("Cannot determine ground truth (no RPCs returned a stable count).");
  } else {
    console.log(`Ground truth count = ${truth} (majority of self-consistent RPCs)`);
    const reliable = results.filter(r =>
      r.chain?.ok && !r.chain.warn &&
      r.call?.allSame && r.call.counts[0] === truth
    );
    const unreliable = results.filter(r =>
      r.chain?.ok && !r.chain.warn &&
      r.call?.allSame && r.call.counts[0] !== truth
    );
    const broken = results.filter(r => !r.chain?.ok || r.chain.warn || !r.call?.allSame);

    console.log(`\nReliable RPCs (count=${truth}, self-consistent, getLogs ${"="} OK is recommended):`);
    for (const r of reliable) {
      const logsOk = r.logs?.ok ? `getLogs(${r.logs.count})` : `getLogs:${r.logs?.error || "n/a"}`;
      console.log(`  ✓ ${r.rpc}  [call ${fmtMs(r.call.avgLatency)}, ${logsOk}]`);
    }

    if (unreliable.length) {
      console.log(`\nUnreliable RPCs (returned wrong count):`);
      for (const r of unreliable) {
        console.log(`  ✗ ${r.rpc}  [returned ${r.call.counts[0]} expected ${truth}]`);
      }
    }

    if (broken.length) {
      console.log(`\nBroken / unstable RPCs:`);
      for (const r of broken) {
        const reason = !r.chain?.ok ? "chain down"
          : r.chain.warn ? `wrong chainId (${r.chain.chainId})`
          : r.call?.error ? `call error: ${truncate(r.call.error, 100)}`
          : !r.call?.allSame ? `inconsistent counts ${(r.call.counts || []).join(",")}`
          : "?";
        console.log(`  ✗ ${r.rpc}  [${reason}]`);
      }
    }

    // Separate getLogs verdict — RPCs reliable for callContract may not support getLogs
    const getLogsOk = reliable.filter(r => r.logs?.ok);
    if (getLogsOk.length) {
      console.log(`\nReliable RPCs that ALSO support getLogs:`);
      for (const r of getLogsOk) {
        console.log(`  ✓ ${r.rpc}  [getLogs ${fmtMs(r.logs.latency)}]`);
      }
    }
    const noGetLogs = reliable.filter(r => !r.logs?.ok);
    if (noGetLogs.length) {
      console.log(`\nReliable for callContract but getLogs FAILS (don't use for getLogs):`);
      for (const r of noGetLogs) {
        console.log(`  ✗ ${r.rpc}  [${truncate(r.logs?.error || "n/a", 100)}]`);
      }
    }
  }
}

function truncate(s, n) {
  s = String(s);
  return s.length > n ? s.slice(0, n) + "..." : s;
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});

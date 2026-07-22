import { JsonRpcProvider, Contract, Wallet, Interface, type TransactionReceipt } from "ethers";
import { HttpError } from "./errors";
import { resolveNetwork, TESTNET_CHAIN_IDS, type NetworkCfg } from "./networks";
import { logger } from "./logger";

// Recursively turn ethers v6 return values (bigint, Result tuples) into JSON-safe data.
export function serialize(v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(serialize);
  if (v && typeof v === "object" && typeof (v as { toArray?: unknown }).toArray === "function") {
    try {
      return serialize((v as { toArray: () => unknown[] }).toArray());
    } catch {
      /* not a Result after all — fall through */
    }
  }
  return v;
}

// Guardrail: build a provider and refuse anything whose REAL chainId (as reported
// by the RPC) is not a whitelisted testnet — blocks a swapped/mainnet RPC url.
export async function makeProvider(net: NetworkCfg): Promise<JsonRpcProvider> {
  const provider = new JsonRpcProvider(net.rpcUrl);
  let id: number;
  try {
    id = Number((await provider.getNetwork()).chainId);
  } catch (e) {
    provider.destroy();
    throw new HttpError(502, `RPC unreachable for ${net.name}: ${(e as Error).message}`);
  }
  if (!TESTNET_CHAIN_IDS.has(id) || id !== net.chainId) {
    provider.destroy();
    throw new HttpError(403, `Refused: RPC reports chainId ${id}, not the whitelisted testnet ${net.chainId} (mainnet is blocked)`);
  }
  return provider;
}

function fragmentOf(method: unknown): string {
  if (typeof method !== "string" || !method.trim()) {
    throw new HttpError(400, "`method` must be a function signature string, e.g. \"deposit(address,uint256)\"");
  }
  const m = method.trim();
  return m.startsWith("function ") ? m : `function ${m}`;
}

function functionName(abiFragment: string): string {
  let iface: Interface;
  try {
    iface = new Interface([abiFragment]);
  } catch (e) {
    throw new HttpError(400, `Cannot parse method: ${(e as Error).message}`);
  }
  const frag = iface.fragments[0];
  if (!frag || frag.type !== "function") throw new HttpError(400, "`method` is not a function fragment");
  return (frag as unknown as { name: string }).name;
}

interface CommonBody {
  network: string;
  address: string;
  method: unknown;
  args: unknown[];
}

function requireBody(body: unknown): CommonBody {
  if (!body || typeof body !== "object") throw new HttpError(400, "JSON body required");
  const b = body as Record<string, unknown>;
  if (typeof b.network !== "string") throw new HttpError(400, "`network` (string) required");
  if (typeof b.address !== "string") throw new HttpError(400, "`address` (string) required");
  const args = b.args ?? [];
  if (!Array.isArray(args)) throw new HttpError(400, "`args` must be an array");
  return { network: b.network, address: b.address, method: b.method, args };
}

export async function handleCall(body: unknown) {
  const { network, address, method, args } = requireBody(body);
  const net = resolveNetwork(network);
  const abi = fragmentOf(method);
  const name = functionName(abi);
  const provider = await makeProvider(net);
  try {
    const contract = new Contract(address, [abi], provider);
    logger.info(`call ${net.name} ${address} ${name}() args=${args.length}`);
    const raw = await contract[name](...args);
    return { network: net.name, chainId: net.chainId, result: serialize(raw) };
  } finally {
    provider.destroy();
  }
}

export async function handleSend(body: unknown) {
  const { network, address, method, args } = requireBody(body);
  const b = body as Record<string, unknown>;
  if (typeof b.privateKey !== "string" || !b.privateKey) {
    throw new HttpError(400, "`privateKey` (string) required for /send");
  }
  const net = resolveNetwork(network);
  const abi = fragmentOf(method);
  const name = functionName(abi);
  const provider = await makeProvider(net);
  try {
    const wallet = new Wallet(b.privateKey, provider);
    const contract = new Contract(address, [abi], wallet);
    const overrides = b.value != null ? { value: BigInt(b.value as string | number) } : {};
    logger.info(`send ${net.name} ${address} ${name}() args=${args.length} from ${wallet.address}`);
    const tx = await contract[name](...args, overrides);
    const receipt = (await tx.wait()) as TransactionReceipt | null;
    return {
      network: net.name,
      chainId: net.chainId,
      from: wallet.address,
      txHash: tx.hash,
      status: receipt?.status ?? null,
      blockNumber: receipt?.blockNumber ?? null,
      gasUsed: receipt?.gasUsed?.toString() ?? null,
      events: parseEvents(receipt, contract.interface),
    };
  } finally {
    provider.destroy();
  }
}

function parseEvents(receipt: TransactionReceipt | null, iface: Interface) {
  if (!receipt?.logs) return [];
  const out: Array<{ name: string; args: unknown }> = [];
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed) out.push({ name: parsed.name, args: serialize(parsed.args) });
    } catch {
      /* a log emitted by a different contract — skip */
    }
  }
  return out;
}

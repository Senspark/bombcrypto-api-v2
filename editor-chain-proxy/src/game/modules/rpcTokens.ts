import { Contract, formatUnits, JsonRpcProvider } from "ethers";
import { makeProvider } from "../../chain";
import { resolveNetwork } from "../../networks";
import { rpcTokenDef } from "../addresses";
import CoinTokenAbi from "../abi/CoinTokenAbi";

// GET_BALANCE — the client's RpcTokens.getBalance path. A balance read targets the
// token's OWN chain (per category), independent of the request network, so it opens
// its own testnet-guarded provider. Returns a human-scaled string (formatUnits),
// matching WebGLBlockchainBridge.GetBalance which double.Parses without dividing.
export async function getRpcBalance(category: number, user: string): Promise<string> {
  const def = rpcTokenDef(category);
  const net = resolveNetwork(def.network);
  const provider: JsonRpcProvider = await makeProvider(net);
  try {
    const c = new Contract(def.address, CoinTokenAbi, provider);
    const raw = await c.getFunction("balanceOf")(user);
    return formatUnits(raw, def.digit);
  } finally {
    provider.destroy();
  }
}

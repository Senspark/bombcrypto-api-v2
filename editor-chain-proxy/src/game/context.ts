import { Contract, type InterfaceAbi, type JsonRpcProvider, type TransactionReceipt, Wallet } from "ethers";
import { HttpError } from "../errors";
import { gasOverrides, waitForReceipt } from "./gas";

// Per-request replacement for the client's global Storage + ContractUtils. In the
// browser, write contracts are bound to `provider.getSigner(userAddress)` and reads
// to the BrowserProvider; here a write is bound to `new Wallet(pk, provider)` and a
// read to the JsonRpcProvider. One GameContext is built per `/game` call and holds
// the (testnet-guarded) provider, the resolved chain, and — for writes — the signer.
export class GameContext {
  readonly signer: Wallet | null;

  constructor(
    readonly provider: JsonRpcProvider,
    readonly network: string,
    readonly chainId: number,
    privateKey?: string,
  ) {
    this.signer = privateKey ? new Wallet(privateKey, provider) : null;
  }

  requireSigner(): Wallet {
    if (!this.signer) throw new HttpError(400, "`privateKey` (string) required for this write command");
    return this.signer;
  }

  // Read-only (provider-bound). Mirrors ContractUtils.createReadContract.
  read(address: string, abi: InterfaceAbi): Contract {
    return new Contract(address, abi, this.provider);
  }

  // Write-capable (signer-bound). Mirrors ContractUtils.createWriteContract, whose
  // signer was `provider.getSigner(userAddress)`; here it's the throwaway Wallet.
  write(address: string, abi: InterfaceAbi): Contract {
    return new Contract(address, abi, this.requireSigner());
  }

  // NFTToken.getDesignContract: call `design()` on the token to get the design
  // contract address, then read it with the design ABI (read-only).
  async designOf(token: Contract, designAbi: InterfaceAbi): Promise<Contract> {
    const designAddress: string = await token.getFunction("design")();
    return this.read(designAddress, designAbi);
  }

  // The standard client write path: estimateGas → double-gas (+Polygon fees) →
  // send → wait N confirmations. `estimateArgs` covers the few methods whose gas
  // is estimated with different args than the real call (e.g. BHero.claim).
  async send(
    contract: Contract,
    name: string,
    args: unknown[],
    opts?: { estimateArgs?: unknown[]; noGas?: boolean; value?: bigint },
  ): Promise<TransactionReceipt | null> {
    const fn = contract.getFunction(name);
    // A payable method needs msg.value on the estimate too, or the estimate reverts on the
    // contract's own price check before it ever reaches the send.
    const value = opts?.value;
    if (opts?.noGas) {
      const tx = value === undefined ? await fn(...args) : await fn(...args, { value });
      return waitForReceipt(tx);
    }
    const estArgs = opts?.estimateArgs ?? args;
    const est = value === undefined
      ? await fn.estimateGas(...estArgs)
      : await fn.estimateGas(...estArgs, { value });
    const overrides = await gasOverrides(this.provider, this.chainId, est);
    const tx = value === undefined
      ? await fn(...args, overrides)
      : await fn(...args, { ...overrides, value });
    return waitForReceipt(tx);
  }
}

import { type Contract, parseEther } from "ethers";
import type { GameContext } from "../context";
import type { BHero } from "./bhero";
import { gasOverrides } from "../gas";
import ClaimManagerAbi from "../abi/ClaimManagerAbi";

export interface ClaimAndProcessResult {
  txHash: string;
  processResult: { result: boolean; fusionFailAmount: number; fusionSuccessHeroIds: number[] } | null;
}

// Ported from Module/ClaimManager.ts. For a Hero-type claim it orchestrates into
// BHero.processTokenRequestsV2 (same cross-module hop as the client).
export class ClaimManager {
  constructor(
    private readonly ctx: GameContext,
    private readonly bhero: BHero,
    readonly address: string,
  ) {}

  private write(): Contract {
    return this.ctx.write(this.address, ClaimManagerAbi);
  }

  private read(): Contract {
    return this.ctx.read(this.address, ClaimManagerAbi);
  }

  // Returns the tx hash ("" on failure). Uses the caller's waitConfirmations, not
  // the default 1 — matching the client's claimTokens.
  async claimTokens(
    tokenType: number,
    amount: number,
    nonce: number,
    details: unknown[],
    signature: string,
    formatType: string,
    waitConfirmations: number,
  ): Promise<string> {
    try {
      const amountValue: string | number = formatType ? parseEther(amount.toString()).toString() : amount;
      const fn = this.write().getFunction("claimTokens");
      const args = [tokenType, amountValue, nonce, details, signature];
      const est = await fn.estimateGas(...args);
      const overrides = await gasOverrides(this.ctx.provider, this.ctx.chainId, est);
      const tx = await fn(...args, overrides);
      const receipt = await tx.wait(waitConfirmations);
      return receipt?.hash?.toString() ?? "";
    } catch {
      return "";
    }
  }

  async claimTokensAndProcess(
    tokenType: number,
    amount: number,
    nonce: number,
    details: unknown[],
    signature: string,
    formatType: string,
    waitConfirmations: number,
    walletAddress: string,
  ): Promise<ClaimAndProcessResult> {
    const txHash = await this.claimTokens(tokenType, amount, nonce, details, signature, formatType, waitConfirmations);
    if (!txHash) return { txHash: "", processResult: null };

    const tokenAddress: string = await this.read().getFunction("tokenContracts")(tokenType);
    const isHero = tokenAddress.toLowerCase() === this.bhero.address.toLowerCase();
    if (!isHero) return { txHash, processResult: null };

    const processResult = await this.bhero.processTokenRequestsV2(walletAddress);
    return { txHash, processResult };
  }

  async userCanUseVoucher(voucherType: number, user: string): Promise<boolean> {
    return await this.read().getFunction("userCanUseVoucher")(voucherType, user);
  }
}

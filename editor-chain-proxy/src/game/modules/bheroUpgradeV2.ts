import { type Contract, toBigInt } from "ethers";
import type { GameContext } from "../context";
import type { CoinToken } from "./coinToken";

// ABI minima do BHeroUpgradeV2 — so o que o Editor consome.
const UpgradeV2Abi = [
  "function getUpgradePriceForHero(uint256 baseId) view returns (uint256 bcoinCost, uint256 senCost, uint256 nativeCost)",
  "function requiredMaterialLevel(uint256 baseLevel) pure returns (uint256)",
  "function getMaxLevel() view returns (uint256)",
  "function upgradeHero(uint256 baseId, uint256 materialId) payable",
];

export interface UpgradeV2Price {
  bcoin: string;
  sen: string;
  native: string;
}

/**
 * Niveis 6-10 no contrato de TESTE, que cobra BCOIN + SEN + nativo.
 *
 * Duas particularidades em relacao aos outros modulos daqui:
 * - O preco sai em TRES valores de uma vez, por hero concreto — a UI nao precisa saber raridade
 *   nem indice de nivel.
 * - `upgradeHero` e payable com `require(msg.value == nativeCost)` e sem devolucao de troco, entao
 *   o preco e relido imediatamente antes de assinar em vez de confiar no que o cliente mandou.
 */
export class BHeroUpgradeV2 {
  constructor(
    private readonly ctx: GameContext,
    private readonly bcoin: CoinToken,
    private readonly sen: CoinToken,
    readonly address: string,
    private readonly heroToken: string,
  ) {}

  private assertDeployed(): void {
    if (!this.address) {
      throw new Error("BHeroUpgradeV2 nao publicado nesta rede");
    }
  }

  private read(): Contract {
    this.assertDeployed();
    return this.ctx.read(this.address, UpgradeV2Abi);
  }

  async getPrice(baseId: number): Promise<UpgradeV2Price> {
    const [bcoin, sen, native] = await this.read().getUpgradePriceForHero(baseId);
    return { bcoin: bcoin.toString(), sen: sen.toString(), native: native.toString() };
  }

  async requiredMaterialLevel(baseLevel: number): Promise<number> {
    return Number(await this.read().requiredMaterialLevel(baseLevel));
  }

  async getMaxLevel(): Promise<number> {
    return Number(await this.read().getMaxLevel());
  }

  async upgrade(
    walletAddress: string,
    baseId: number,
    materialId: number,
  ): Promise<{ success: boolean; txHash: string; details: string }> {
    this.assertDeployed();
    // Releitura no momento da assinatura: o valor precisa bater exato e nao ha troco.
    const price = await this.getPrice(baseId);
    const bcoinCost = toBigInt(price.bcoin);
    const senCost = toBigInt(price.sen);
    if (bcoinCost > 0n) {
      await this.bcoin.checkAllowance(walletAddress, this.address, bcoinCost);
    }
    if (senCost > 0n) {
      await this.sen.checkAllowance(walletAddress, this.address, senCost);
    }
    const contract = this.ctx.write(this.address, UpgradeV2Abi);
    const tx = await contract.upgradeHero(baseId, materialId, { value: toBigInt(price.native) });
    await tx.wait();
    // O cliente desserializa em HeroActionResult; devolver um boolean quebra com
    // "Error converting value True to type 'App.HeroActionResult'".
    const details = await this.ctx
      .read(this.heroToken, ["function tokenDetails(uint256) view returns (uint256)"])
      .tokenDetails(baseId);
    return { success: true, txHash: tx.hash ?? "", details: details.toString() };
  }
}

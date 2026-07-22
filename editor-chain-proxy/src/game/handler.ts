import { formatUnits } from "ethers";
import { makeProvider } from "../chain";
import { HttpError } from "../errors";
import { resolveNetwork } from "../networks";
import { Bridge } from "./bridge";
import { GameContext } from "./context";
import { GameManager } from "./manager";
import { getRpcBalance } from "./modules/rpcTokens";

// POST /game — the "game-contract gateway". Mirrors the React client's
// CallBlockChain(command, param): the Editor sends a command token + a param
// object; the proxy resolves addresses/ABI and runs it against a testnet RPC.
// Reads need no key; writes carry a throwaway testnet privateKey.
//
// Body: { network, command, param?, privateKey? }
// Response (via the server wrapper): { success: true, result: <value|txInfo> }.
// The `result` is the exact value the client's ContractManager method returned,
// so the Editor manager can mirror WebGLBlockchainBridge's parsing/decimals.

interface GameBody {
  network: string;
  command: string;
  param: Record<string, unknown>;
  privateKey?: string;
}

function requireBody(body: unknown): GameBody {
  if (!body || typeof body !== "object") throw new HttpError(400, "JSON body required");
  const b = body as Record<string, unknown>;
  if (typeof b.network !== "string") throw new HttpError(400, "`network` (string) required");
  if (typeof b.command !== "string" || !b.command) throw new HttpError(400, "`command` (string) required");
  // param may arrive as an object or a JSON string (matching CallBlockChain).
  let param: Record<string, unknown> = {};
  if (b.param != null) {
    param = typeof b.param === "string" ? JSON.parse(b.param) : (b.param as Record<string, unknown>);
    if (!param || typeof param !== "object") throw new HttpError(400, "`param` must be an object or JSON string");
  }
  const privateKey = typeof b.privateKey === "string" ? b.privateKey : undefined;
  return { network: b.network, command: b.command, param, privateKey };
}

function str(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  if (typeof v === "string" && v) return v;
  if (typeof v === "number") return String(v);
  throw new HttpError(400, `param.${key} (string) required`);
}

function num(p: Record<string, unknown>, key: string): number {
  const v = p[key];
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  throw new HttpError(400, `param.${key} (number) required`);
}

function numArr(p: Record<string, unknown>, key: string): number[] {
  const v = p[key];
  if (Array.isArray(v)) return v.map((x) => Number(x));
  throw new HttpError(400, `param.${key} (number[]) required`);
}

function anyArr(p: Record<string, unknown>, key: string): unknown[] {
  const v = p[key];
  if (Array.isArray(v)) return v;
  throw new HttpError(400, `param.${key} (array) required`);
}

function requireKey(req: GameBody): string {
  if (!req.privateKey) throw new HttpError(400, `\`privateKey\` (string) required for ${req.command}`);
  return req.privateKey;
}

export async function handleGame(body: unknown) {
  const req = requireBody(body);
  const net = resolveNetwork(req.network);
  const provider = await makeProvider(net);
  try {
    const ctx = new GameContext(provider, net.name, net.chainId, req.privateKey);
    const p = req.param;
    let manager: GameManager | null = null;
    const game = (): GameManager => (manager ??= new GameManager(ctx));
    let bridgeInst: Bridge | null = null;
    const bridge = (): Bridge => (bridgeInst ??= new Bridge(provider, net.name, net.chainId));

    switch (req.command) {
      // ── Cross-chain DepositBridge (Milestone 1) ──
      case "BRIDGE_GET_DEPOSITED":
        return { result: await bridge().deposited(str(p, "walletAddress"), str(p, "token")) };
      case "BRIDGE_GET_WITHDRAWN":
        return { result: await bridge().withdrawn(str(p, "walletAddress"), str(p, "token")) };
      case "BRIDGE_GET_DEPOSIT_ENABLED":
        return { result: await bridge().depositEnabled() };
      case "BRIDGE_GET_WITHDRAW_ENABLED":
        return { result: await bridge().withdrawEnabled() };
      case "BRIDGE_DEPOSIT":
        return { result: await bridge().deposit(requireKey(req), str(p, "token"), str(p, "amountWei")) };
      case "BRIDGE_WITHDRAW":
        return {
          result: await bridge().withdraw(
            requireKey(req),
            str(p, "token"),
            str(p, "otherDeposited"),
            str(p, "deadline"),
            str(p, "signature"),
          ),
        };

      // ── Balances ──
      case "GET_BALANCE":
        return { result: await getRpcBalance(num(p, "category"), str(p, "walletAddress")) };

      // ── Hero (reads) ──
      case "GET_HERO_ID_COUNTER":
        return { result: await game().bhero.getIdCounter() };
      case "GET_HERO_LIMIT":
        return { result: await game().bhero.getTokenLimit() };
      case "GET_HERO_PRICE":
        return { result: await heroPrice(game()) };
      case "GET_HERO_UPGRADE_COST":
        return { result: await game().bhero.getUpgradeCosts() };
      case "GET_HERO_ABILITY_DESIGNS":
        return { result: await game().bhero.getAbilityDesigns() };
      case "GET_CLAIMABLE_HERO":
        return { result: await game().bhero.getClaimableTokens(str(p, "walletAddress")) };
      case "GET_PENDING_HERO":
        return { result: await game().bhero.getPendingTokens(str(p, "walletAddress")) };
      case "IS_SUPER_BOX_ENABLED":
        return { result: await game().bhero.isSuperBoxEnabled() };
      case "HAS_PENDING_HERO_RANDOMIZE":
        return { result: await game().bhero.hasPendingRandomization(num(p, "heroId")) };

      // ── Hero (writes) ──
      case "BUY_HERO":
        return { result: await game().bhero.mint(str(p, "walletAddress"), num(p, "count"), num(p, "category")) };
      case "BUY_HERO_S":
        return { result: await game().bheroS.mint(str(p, "walletAddress"), num(p, "count")) };
      case "UPGRADE_HERO":
        return { result: await game().bhero.upgrade(str(p, "walletAddress"), num(p, "baseId"), num(p, "materialId")) };
      case "CLAIM_HERO":
        return { result: await game().bhero.claim(str(p, "walletAddress")) };
      case "PROCESS_TOKEN_REQUESTS":
        return { result: await game().bhero.processTokenRequests() };
      case "RANDOMIZE_HERO_ABILITIES":
        return { result: await game().bhero.randomizeAbilities(str(p, "walletAddress"), num(p, "heroId")) };
      case "PROCESS_HERO_RANDOMIZE_AB":
        return { result: await game().bhero.processRandomizeAbilities(num(p, "heroId")) };

      // ── HeroS / fusion / shield / rock ──
      case "FUSION_HERO":
        return { result: await game().bheroS.burnFusion(numArr(p, "heroIds")) };
      case "FUSION":
        return { result: await game().bheroS.fusion(numArr(p, "mainHeroIds"), numArr(p, "secondHeroIds")) };
      case "REPAIR_SHIELD":
        return { result: await game().bheroS.burnRepairShield(num(p, "idHeroS"), numArr(p, "idHeroesBurn")) };
      case "GET_ROCK_AMOUNT":
        return { result: await game().bheroS.getAmountRock(str(p, "walletAddress")) };
      case "CREATE_ROCK":
        return { result: await game().bheroS.createRock(numArr(p, "idHeroesBurn")) };
      case "REPAIR_SHIELD_WITH_ROCK":
        return { result: await game().bheroS.resetShieldHeroS(num(p, "idHeroS"), num(p, "amountRock")) };
      case "UPGRADE_SHIELD_LEVEL":
        return { result: await game().bheroS.upgradeShieldLevel(num(p, "idHeroS"), num(p, "amountRock")) };
      case "UPGRADE_SHIELD_LEVEL_V2":
        return { result: await game().bheroS.upgradeShieldLevelV2(num(p, "idHero"), num(p, "nonce"), str(p, "signature")) };

      // ── House ──
      case "GET_HOUSE_LIMIT":
        return { result: await game().bhouse.getTokenLimit() };
      case "GET_HOUSE_PRICE":
        return { result: await game().bhouse.getMintCosts() };
      case "GET_AVAILABLE_HOUSE":
        return { result: await game().bhouse.getMintAvailable() };
      case "GET_HOUSE_MINT_LIMITS":
        return { result: await game().bhouse.getMintLimits() };
      case "GET_HOUSE_STATS":
        return { result: await game().bhouse.getRarityStats() };
      case "BUY_HOUSE":
        return { result: await game().bhouse.mint(str(p, "walletAddress"), num(p, "rarity")) };

      // ── Deposit ──
      case "DEPOSIT_V2":
        return { result: await game().deposit.depositV2(str(p, "walletAddress"), num(p, "amount"), num(p, "category")) };

      // ── Claim token / voucher ──
      case "CLAIM_TOKEN":
        return {
          result: await game().claimManager.claimTokensAndProcess(
            num(p, "tokenType"),
            num(p, "amount"),
            num(p, "nonce"),
            anyArr(p, "details"),
            str(p, "signature"),
            str(p, "formatType"),
            num(p, "waitConfirmations"),
            str(p, "walletAddress"),
          ),
        };
      case "CAN_USE_VOUCHER":
        return { result: await game().claimManager.userCanUseVoucher(num(p, "voucherType"), str(p, "walletAddress")) };

      // ── Hero stake ──
      case "STAKE_TO_HERO_V2":
        return { result: await game().heroStake.depositV2(str(p, "walletAddress"), num(p, "id"), num(p, "amount"), num(p, "category")) };
      case "WITHDRAW_FROM_HERO_ID_V2":
        return { result: await game().heroStake.withdrawV2(num(p, "id"), num(p, "amount"), num(p, "category")) };
      case "GET_STAKE_FROM_HERO_ID_V2":
        return { result: await game().heroStake.getCoinBalanceV2(num(p, "id"), num(p, "category")) };
      case "GET_FEE_FROM_HERO_ID_V2":
        return { result: await game().heroStake.getWithdrawFeeV2(num(p, "id"), num(p, "category")) };

      default:
        throw new HttpError(400, `Unknown command '${req.command}'`);
    }
  } finally {
    provider.destroy();
  }
}

// GET_HERO_PRICE returns a BHeroPrice struct (human-scaled). The client reads only
// coin/sen on-chain; the airdrop-token fields are 0 (not on-chain here).
async function heroPrice(game: GameManager) {
  const coin = Number(formatUnits(await game.bhero.getMintCost(), 18));
  const sen = Number(formatUnits(await game.bhero.getSenMintCost(), 18));
  return { coin, sen, ton: 0, star_core: 0, bcoin_deposited: 0, sol: 0, ron: 0, bas: 0, vic: 0 };
}

// Browser-wallet (MetaMask) side of the monitor: the ONLY on-chain WRITE the page does.
// fundLiquidity is permissionless but pulls tokens from msg.sender, so the operator funds from
// their own connected wallet — no key/liquidity ever lives on the server.
import {BrowserProvider, Contract, formatUnits, parseUnits} from "ethers";

const ERC20_ABI = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
];
const BRIDGE_ABI = [
    "function fundLiquidity(address token, uint256 amount)",
    "function setDepositEnabled(bool enabled)",
    "function setWithdrawEnabled(bool enabled)",
];

function eth(): any {
    const e = (window as any).ethereum;
    if (!e) throw new Error("Không tìm thấy ví (cài MetaMask)");
    return e;
}

// Make the wallet point at the chain we're funding — funding the wrong chain would send real tokens
// to the wrong bridge. Errors out rather than guessing if the user declines the switch.
async function ensureChain(chainId: number): Promise<void> {
    const e = eth();
    const hex = "0x" + chainId.toString(16);
    const current: string = await e.request({method: "eth_chainId"});
    if (current?.toLowerCase() === hex.toLowerCase()) return;
    try {
        await e.request({method: "wallet_switchEthereumChain", params: [{chainId: hex}]});
    } catch {
        throw new Error(`Hãy chuyển ví sang chainId ${chainId} rồi thử lại`);
    }
}

export type FundStep = "approve" | "fund";

export async function fundLiquidity(
    chainId: number,
    bridgeAddress: string,
    tokenAddress: string,
    humanAmount: string,
    onStep?: (step: FundStep) => void,
): Promise<string> {
    const e = eth();
    await e.request({method: "eth_requestAccounts"});
    await ensureChain(chainId);

    const signer = await new BrowserProvider(e).getSigner();
    const owner = await signer.getAddress();

    const token = new Contract(tokenAddress, ERC20_ABI, signer);
    const decimals: number = Number(await token.decimals());
    const amount = parseUnits(humanAmount, decimals);
    if (amount <= 0n) throw new Error("Số lượng phải > 0");

    const balance: bigint = await token.balanceOf(owner);
    if (balance < amount) {
        throw new Error(`Số dư ví không đủ (có ${formatUnits(balance, decimals)})`);
    }

    const allowance: bigint = await token.allowance(owner, bridgeAddress);
    if (allowance < amount) {
        onStep?.("approve");
        await (await token.approve(bridgeAddress, amount)).wait();
    }

    onStep?.("fund");
    const bridge = new Contract(bridgeAddress, BRIDGE_ABI, signer);
    const tx = await bridge.fundLiquidity(tokenAddress, amount);
    await tx.wait();
    return tx.hash;
}

// Flip a bridge direction on/off (setDepositEnabled / setWithdrawEnabled). Needs MANAGER_ROLE on the
// connected wallet — the tx reverts otherwise, surfaced as an error to the operator.
export async function setBridgeFlag(
    chainId: number,
    bridgeAddress: string,
    flag: "deposit" | "withdraw",
    enabled: boolean,
): Promise<string> {
    const e = eth();
    await e.request({method: "eth_requestAccounts"});
    await ensureChain(chainId);

    const signer = await new BrowserProvider(e).getSigner();
    const bridge = new Contract(bridgeAddress, BRIDGE_ABI, signer);
    const tx = flag === "deposit"
        ? await bridge.setDepositEnabled(enabled)
        : await bridge.setWithdrawEnabled(enabled);
    await tx.wait();
    return tx.hash;
}

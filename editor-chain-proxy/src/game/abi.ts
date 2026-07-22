// Human-readable ABI fragments (ethers v6 parses these directly). Only the
// functions the bridge flow touches — kept minimal on purpose.
export const BRIDGE_ABI = [
  "function deposit(address token, uint256 amount)",
  "function withdraw(address token, uint256 otherDeposited, uint256 deadline, bytes signature)",
  "function deposited(address user, address token) view returns (uint256)",
  "function withdrawn(address user, address token) view returns (uint256)",
  "function feePercent() view returns (uint256)",
  "function supportedToken(address token) view returns (bool)",
  "function depositEnabled() view returns (bool)",
  "function withdrawEnabled() view returns (bool)",
  "event Withdraw(address indexed user, address indexed token, uint256 amount, uint256 net, uint256 otherDeposited, uint256 deadline, uint256 withdrawnTotal)",
];

export const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

import {Interface, Wallet, formatEther, parseEther, parseUnits} from 'ethers';

const MIN_CHANGE = 0.05;
const MAX_CHANGE = 0.25;
const RECEIPT_POLL_MS = 5_000;
const RECEIPT_TIMEOUT_MS = 5 * 60_000;
const HTTP_TIMEOUT_MS = 60_000;

const NETWORKS = {
    prod: [
        {name: 'BSC', chainId: 56, symbol: 'BNB', minGas: parseEther('0.0005'), prices: 'bnb', design: '0x516e792268416c58b82565CeF088cFB9575A750a', explorer: 'https://bscscan.com'},
        {name: 'POLYGON', chainId: 137, symbol: 'POL', minGas: parseEther('0.05'), prices: 'polygon', design: '0x124c7569D4E1723b5e90a81E8dc9b5237444D190', explorer: 'https://polygonscan.com'},
    ],
    test: [
        {name: 'BSC', chainId: 97, symbol: 'BNB', minGas: parseEther('0.0005'), prices: 'bnb', design: '0x077A8522325aD6961d0b173C7e18aFfb9680c010', explorer: 'https://testnet.bscscan.com'},
        {name: 'POLYGON', chainId: 80002, symbol: 'POL', minGas: parseEther('0.05'), prices: 'polygon', design: '0xdbf9ed414cbeb80f14f677cebc7ccdca5bda351a', explorer: 'https://amoy.polygonscan.com'},
    ],
};

const DESIGN_ABI = [
    'function getNativeRate() view returns (uint256)',
    'function setNativeRate(uint256 value)',
];
const design = new Interface(DESIGN_ABI);

function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
}

const env = {
    privateKey: requireEnv('PRIVATE_KEY'),
    apBlockchainUrl: requireEnv('AP_BLOCKCHAIN_URL').replace(/\/$/, ''),
    centerUrl: requireEnv('BLOCKCHAIN_CENTER_URL').replace(/\/$/, ''),
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL ?? '',
    isProd: process.env.IS_PROD === 'true',
    dryRun: process.env.DRY_RUN === 'true',
};
const wallet = new Wallet(env.privateKey);

function log(message) {
    console.log(`${new Date().toISOString()} ${message}`);
}

async function getCoinsPrice() {
    const res = await fetch(`${env.apBlockchainUrl}/coins_price`, {signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)});
    const body = await res.json();
    if (body.code !== 0) throw new Error(`coins_price answered ${JSON.stringify(body)}`);
    return body.message;
}

async function center(path, body) {
    const res = await fetch(`${env.centerUrl}/${path}`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    const json = await res.json();
    if (!json.success) throw new Error(`${path}: ${json.errorString}`);
    return json.result;
}

async function slack(text) {
    if (!env.slackWebhookUrl) return;
    try {
        const res = await fetch(env.slackWebhookUrl, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({text}),
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
        });
        if (!res.ok) log(`slack answered ${res.status}`);
    } catch (e) {
        log(`slack post failed: ${e.message}`);
    }
}

async function waitReceipt(network, hash) {
    const deadline = Date.now() + RECEIPT_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const receipt = await center('getTransactionReceipt', {network, txHash: hash});
        if (receipt) return receipt;
        await new Promise((resolve) => setTimeout(resolve, RECEIPT_POLL_MS));
    }
    throw new Error(`tx ${hash} not mined after ${RECEIPT_TIMEOUT_MS / 60_000} min`);
}

async function setRate(net, rate) {
    const network = net.name;
    const data = design.encodeFunctionData('setNativeRate', [rate]);
    // Reverts here (missing DESIGNER_ROLE, paused) cost nothing, so DRY_RUN goes this far too.
    const gasLimit = BigInt(await center('estimateGas', {network, from: wallet.address, to: net.design, data}));
    if (env.dryRun) return null;

    const nonce = await center('getTransactionCount', {network, address: wallet.address, blockTag: 'pending'});
    const fee = await center('getFeeData', {network});
    // BSC has a zero base fee, so ethers reports no EIP-1559 fees there and a legacy gas price is used.
    const fees = fee.maxFeePerGas
        ? {type: 2, maxFeePerGas: BigInt(fee.maxFeePerGas), maxPriorityFeePerGas: BigInt(fee.maxPriorityFeePerGas)}
        : {type: 0, gasPrice: BigInt(fee.gasPrice)};
    const signedTx = await wallet.signTransaction({
        to: net.design, data, nonce, chainId: net.chainId, gasLimit: gasLimit * 12n / 10n, ...fees,
    });
    const hash = await center('sendRawTransaction', {network, signedTx});
    log(`${network} sent tx ${hash}`);

    const receipt = await waitReceipt(network, hash);
    if (receipt.status !== 1) throw new Error(`tx ${hash} reverted`);
    return hash;
}

async function run(net, prices) {
    const network = net.name;
    const bcoin = prices[`${net.prices}_bcoin`];
    const native = prices[`${net.prices}_native`];
    if (!(bcoin > 0) || !(native > 0)) throw new Error(`no usable price: bcoin=${bcoin} native=${native}`);

    // 12 significant digits drop the division's float noise; String() then prints 0.18, not 0.17999…,
    // but switches to exponent form below 1e-6, which parseUnits rejects.
    const ratio = Number((bcoin / native).toPrecision(12));
    const target = parseUnits(ratio < 1e-6 ? ratio.toFixed(18) : String(ratio), 18);
    // A single return value comes back bare, as a decimal string.
    const current = BigInt(await center('callContract', {
        network, contractAddress: net.design, abi: DESIGN_ABI, methodName: 'getNativeRate', args: [],
    }));
    // 0 is how the three native features are closed on purpose; reopening them is not this job's call.
    if (current === 0n) {
        log(`${network} on-chain rate is 0 (features closed), leaving it`);
        return;
    }

    const change = Number(target - current) / Number(current);
    const label = `${formatEther(current)} -> ${formatEther(target)} (${(change * 100).toFixed(2)}%)`;

    if (Math.abs(change) < MIN_CHANGE) {
        log(`${network} skip ${label}: below ${MIN_CHANGE * 100}%`);
        return;
    }
    if (change <= -MAX_CHANGE) {
        log(`${network} NOT set ${label}: drop beyond ${MAX_CHANGE * 100}%`);
        await slack(`:warning: *${network}* HeroDesign nativeRate ${label} - drop beyond ${MAX_CHANGE * 100}%, NOT set. Check the price and run set-native-rate.js by hand if it is real.`);
        return;
    }

    const hash = await setRate(net, target);
    if (!hash) {
        log(`${network} DRY_RUN would set ${label}`);
        return;
    }
    log(`${network} set ${label} tx ${hash}`);
    if (change >= MAX_CHANGE) {
        await slack(`:chart_with_upwards_trend: *${network}* HeroDesign nativeRate ${label} - rise beyond ${MAX_CHANGE * 100}%, set. <${net.explorer}/tx/${hash}|tx>`);
    }
}

// Checked every run, not only after a write: an empty wallet is found out before the day it is needed.
async function checkGas(net) {
    const balance = BigInt(await center('getBalance', {network: net.name, address: wallet.address}));
    if (balance >= net.minGas) return;
    log(`${net.name} keeper gas low: ${formatEther(balance)} ${net.symbol}`);
    await slack(`:fuelpump: *${net.name}* native-rate-keeper \`${wallet.address}\` has ${formatEther(balance)} ${net.symbol}, below ${formatEther(net.minGas)}. Top it up or the next rate change cannot be sent.`);
}

async function main() {
    log(`start prod=${env.isProd} dryRun=${env.dryRun} keeper=${wallet.address}`);
    const prices = await getCoinsPrice();
    let failed = false;
    for (const net of NETWORKS[env.isProd ? 'prod' : 'test']) {
        try {
            await run(net, prices);
        } catch (e) {
            failed = true;
            log(`${net.name} failed: ${e.message}`);
        }
        try {
            await checkGas(net);
        } catch (e) {
            failed = true;
            log(`${net.name} gas check failed: ${e.message}`);
        }
    }
    process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
    log(`failed: ${e.message}`);
    process.exitCode = 1;
});

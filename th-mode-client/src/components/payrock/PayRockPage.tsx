import React, {useEffect, useState} from 'react';
import {Alert, Button, Card, Input, Select, Space, Typography} from 'antd';
import {ExportOutlined, SearchOutlined} from '@ant-design/icons';
import {motion} from 'framer-motion';
import PayRockPreviewCard from './PayRockPreviewCard';
import {confirmPayRock, previewPayRock} from './PayRockApi';
import {IConfirmResult, IPreviewBody, Network} from './PayRockData';
import {buildAdvancedFilterUrl} from './PayRockConsts';
import './PayRockPage.css';

const {Title, Text} = Typography;

const TX_HASH_REGEX = /0x[0-9a-fA-F]{64}/;
const WALLET_REGEX = /^0x[0-9a-f]{40}$/;

function detectNetworkFromInput(input: string): Network | null {
    const lc = input.toLowerCase();
    if (lc.includes('polygonscan.com')) return 'POLYGON';
    if (lc.includes('bscscan.com')) return 'BSC';
    return null;
}

const NETWORK_OPTIONS = [
    {value: 'BSC' as Network, label: 'BSC'},
    {value: 'POLYGON' as Network, label: 'Polygon'},
];

const PayRockPage: React.FC = () => {
    // Helper card state (open explorer with pre-filtered burn txs)
    const [helperWallet, setHelperWallet] = useState('');
    const [helperNetwork, setHelperNetwork] = useState<Network | undefined>(undefined);
    const [helperError, setHelperError] = useState<string | null>(null);

    // Claim card state
    const [txInput, setTxInput] = useState('');
    const [txNetwork, setTxNetwork] = useState<Network | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);

    const [previewing, setPreviewing] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [preview, setPreview] = useState<IPreviewBody | null>(null);
    const [result, setResult] = useState<IConfirmResult | null>(null);

    useEffect(() => {
        document.title = 'Bombcrypto - Claim Quartz';
    }, []);

    const reset = () => {
        setPreview(null);
        setResult(null);
        setError(null);
    };

    const onOpenExplorer = () => {
        if (!helperNetwork) {
            setHelperError('Please select a network (BSC or Polygon).');
            return;
        }
        const wallet = helperWallet.trim().toLowerCase();
        if (!WALLET_REGEX.test(wallet)) {
            setHelperError('Wallet must be 0x + 40 hex.');
            return;
        }
        setHelperError(null);
        window.open(buildAdvancedFilterUrl(helperNetwork, wallet), '_blank', 'noopener,noreferrer');
    };

    const onSubmitPreview = async () => {
        if (!txNetwork) {
            setError('Please select a network (BSC or Polygon).');
            return;
        }
        const trimmed = txInput.trim();
        if (!trimmed) {
            setError('Please enter a tx hash or a scan URL.');
            return;
        }
        const match = trimmed.match(TX_HASH_REGEX);
        if (!match) {
            setError('Could not find a tx hash. Paste either the 0x… hash or a BscScan / PolygonScan URL.');
            return;
        }

        reset();
        setPreviewing(true);
        const res = await previewPayRock(match[0].toLowerCase(), txNetwork);
        setPreviewing(false);

        if (!res.ok) {
            setError(formatApiError(res.status, res.error));
            return;
        }
        setPreview(res.data);
    };

    const onConfirm = async () => {
        if (!preview) return;
        setConfirming(true);
        setError(null);
        const res = await confirmPayRock(preview.input.tx, preview.input.network, preview.summary.totalRock);
        setConfirming(false);

        if (!res.ok) {
            setError(formatApiError(res.status, res.error));
            return;
        }
        setResult(res.data);
        setPreview(null);
    };

    return (
        <div className="payrock-container">
            <motion.div
                initial={{opacity: 0, y: -20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.4}}
                className="payrock-title-container"
            >
                <Title className="payrock-title">
                    <img src="/tiny_rock.png" alt="" className="payrock-title-icon"/>
                    Claim Quartz <span className="payrock-title-suffix">(Rock)</span>
                </Title>
                <Text className="payrock-subtitle" type="secondary">
                    Get back any quartz from past burn transactions that wasn't credited to your account.
                </Text>
            </motion.div>

            <Card
                className="payrock-helper-card"
                bordered={false}
                title="Don't have the tx hash?"
            >
                <Space direction="vertical" size={10} style={{width: '100%'}}>
                    <Text type="secondary" className="payrock-helper-desc">
                        Open the explorer with your burn transactions pre-filtered, copy the tx hash you want to claim,
                        and paste it below.
                    </Text>
                    <div className="payrock-input-row">
                        <Input
                            value={helperWallet}
                            placeholder="Your wallet (0x…)"
                            onChange={(e) => {
                                setHelperWallet(e.target.value);
                                if (helperError) setHelperError(null);
                            }}
                            onPressEnter={onOpenExplorer}
                            maxLength={50}
                        />
                        <Select<Network>
                            value={helperNetwork}
                            placeholder="Select network"
                            style={{minWidth: 160}}
                            onChange={(v) => {
                                setHelperNetwork(v);
                                if (helperError) setHelperError(null);
                            }}
                            options={NETWORK_OPTIONS}
                        />
                        <Button
                            icon={<ExportOutlined/>}
                            onClick={onOpenExplorer}
                        >
                            Open scan filter
                        </Button>
                    </div>
                    {helperError && <Alert type="error" showIcon message={helperError}/>}
                </Space>
            </Card>

            <Card className="payrock-input-card" bordered={false} title="Claim by tx hash">
                <Space direction="vertical" size={12} style={{width: '100%'}}>
                    <div className="payrock-input-row">
                        <Input
                            value={txInput}
                            placeholder="0xTx hash, or https://bscscan.com/tx/0x…"
                            onChange={(e) => {
                                const val = e.target.value;
                                setTxInput(val);
                                const detected = detectNetworkFromInput(val);
                                if (detected) setTxNetwork(detected);
                                if (error) setError(null);
                            }}
                            onPressEnter={onSubmitPreview}
                            maxLength={200}
                        />
                        <Select<Network>
                            value={txNetwork}
                            placeholder="Select network"
                            style={{minWidth: 160}}
                            onChange={(v) => {
                                setTxNetwork(v);
                                if (error) setError(null);
                            }}
                            options={NETWORK_OPTIONS}
                        />
                        <Button
                            type="primary"
                            icon={<SearchOutlined/>}
                            loading={previewing}
                            onClick={onSubmitPreview}
                        >
                            Preview
                        </Button>
                    </div>

                    {error && <Alert type="error" showIcon message={error}/>}
                </Space>
            </Card>

            {preview && (
                <PayRockPreviewCard preview={preview} confirming={confirming} onConfirm={onConfirm}/>
            )}

            {result && (
                <Card className="payrock-result-card" bordered={false} title="Result">
                    <Space direction="vertical" size={10} style={{width: '100%'}}>
                        <Text>
                            Claimed <Text strong>{result.summary.totalRockCredited}</Text> quartz
                            to <Text code>{result.summary.wallet ?? '-'}</Text>.
                        </Text>
                        {result.summary.rockBefore != null && result.summary.rockAfter != null && (
                            <div className="payrock-rock-delta-row payrock-rock-delta-row--result">
                                <span className="payrock-rock-label">ROCK</span>
                                <span className="payrock-rock-before">{result.summary.rockBefore}</span>
                                <span className="payrock-rock-arrow">→</span>
                                <span className="payrock-rock-after">{result.summary.rockAfter}</span>
                            </div>
                        )}
                        {result.failed.length > 0 && (
                            <Alert
                                type="warning"
                                showIcon
                                message="Some txs failed"
                                description={result.failed.map(f => `${f.tx}: ${f.message}`).join('\n')}
                                style={{whiteSpace: 'pre-wrap'}}
                            />
                        )}
                    </Space>
                </Card>
            )}
        </div>
    );
};

function formatApiError(status: number, err: { error: string; [k: string]: any }): string {
    const base = err.error || `HTTP ${status}`;
    const extras: string[] = [];
    if (err.expected != null && err.received != null) extras.push(`expected=${err.expected} received=${err.received}`);
    return extras.length ? `${base} (${extras.join(', ')})` : base;
}

export default PayRockPage;

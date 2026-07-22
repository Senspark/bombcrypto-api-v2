import React from 'react';
import {Alert, Button, Card, Descriptions, Space, Tag, Typography} from 'antd';
import {CheckCircleOutlined} from '@ant-design/icons';
import {IPreviewBody, PerTxStatusPreview} from './PayRockData';
import './PayRockPage.css';

const {Text} = Typography;

const STATUS_LABEL: Record<PerTxStatusPreview, string> = {
    PAYABLE: 'Payable',
    ALREADY_PAID: 'Already paid',
    INVALID_NOT_BURN: 'Not a burn tx',
    INVALID_NO_HERO_DATA: 'No hero data',
    INVALID_ZERO_ROCK: 'Zero quartz',
    ERROR_BLOCKCHAIN_API: 'Blockchain API error',
};

const STATUS_COLOR: Record<PerTxStatusPreview, string> = {
    PAYABLE: 'green',
    ALREADY_PAID: 'blue',
    INVALID_NOT_BURN: 'default',
    INVALID_NO_HERO_DATA: 'orange',
    INVALID_ZERO_ROCK: 'gold',
    ERROR_BLOCKCHAIN_API: 'red',
};

const NON_PAYABLE_HINT: Record<Exclude<PerTxStatusPreview, 'PAYABLE'>, string> = {
    ALREADY_PAID: 'This transaction was already credited to a wallet.',
    INVALID_NOT_BURN: "This transaction isn't a Create Rock (burn) call on the BHeroS contract.",
    INVALID_NO_HERO_DATA: "Hero data for this burn isn't in our database — cannot compute quartz.",
    INVALID_ZERO_ROCK: 'This burn would yield 0 quartz based on the hero rarity / type.',
    ERROR_BLOCKCHAIN_API: 'The internal blockchain API failed to validate this tx. Please retry.',
};

const networkTag = (network: 'BSC' | 'POLYGON') => {
    const color = network === 'BSC' ? '#f0b90b' : '#8247e5';
    return <Tag color={color}>{network}</Tag>;
};

const shortHash = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-8)}`;

interface IProps {
    preview: IPreviewBody;
    confirming: boolean;
    onConfirm: () => void;
}

const PayRockPreviewCard: React.FC<IProps> = ({preview, confirming, onConfirm}) => {
    const item = preview.items[0];
    if (!item) return null;

    const isPayable = item.status === 'PAYABLE';
    const currentRock = item.currentRock;
    const projectedRock = currentRock != null ? currentRock + item.rockAmount : null;

    return (
        <Card
            className="payrock-preview-card"
            bordered={false}
            title={<><img src="/tiny_rock.png" alt="" className="payrock-card-icon"/> Preview</>}
        >
            <Descriptions
                size="small"
                column={1}
                className="payrock-desc"
                labelStyle={{color: '#8c96a6', width: 110}}
            >
                <Descriptions.Item label="Network">{networkTag(item.network)}</Descriptions.Item>
                <Descriptions.Item label="Tx">
                    <span className="payrock-tx-cell">{shortHash(item.tx)}</span>
                </Descriptions.Item>
                {item.wallet && (
                    <Descriptions.Item label="Wallet">
                        <span className="payrock-tx-cell">{item.wallet}</span>
                    </Descriptions.Item>
                )}
                {item.heroIds.length > 0 && (
                    <Descriptions.Item label="Heroes">
                        <Text>{item.heroIds.join(', ')}</Text>
                    </Descriptions.Item>
                )}
                <Descriptions.Item label="Status">
                    <Tag color={STATUS_COLOR[item.status]}>{STATUS_LABEL[item.status]}</Tag>
                </Descriptions.Item>
            </Descriptions>

            {isPayable ? (
                <div className="payrock-rock-delta">
                    <div className="payrock-rock-delta-amount">+{item.rockAmount} <span>Quartz</span></div>
                    {currentRock != null && projectedRock != null && (
                        <div className="payrock-rock-delta-row">
                            <span className="payrock-rock-label">ROCK</span>
                            <span className="payrock-rock-before">{currentRock}</span>
                            <span className="payrock-rock-arrow">→</span>
                            <span className="payrock-rock-after">{projectedRock}</span>
                        </div>
                    )}
                </div>
            ) : (
                <Alert
                    type={item.status === 'ALREADY_PAID' ? 'info' : 'warning'}
                    showIcon
                    message={STATUS_LABEL[item.status]}
                    description={
                        <>
                            <div>{NON_PAYABLE_HINT[item.status as Exclude<PerTxStatusPreview, 'PAYABLE'>]}</div>
                            {item.status === 'ALREADY_PAID' && item.rockAmount > 0 && (
                                <div>Previously credited: <Text strong>{item.rockAmount}</Text> quartz.</div>
                            )}
                            {item.message && <div><Text type="secondary">{item.message}</Text></div>}
                        </>
                    }
                />
            )}

            {isPayable && (
                <div className="payrock-confirm-row">
                    <Space direction="vertical" align="end" size={4}>
                        <Text type="secondary">
                            Preview expires at {new Date(preview.expiresAt * 1000).toLocaleTimeString()}
                        </Text>
                        <Button
                            type="primary"
                            danger
                            icon={<CheckCircleOutlined/>}
                            loading={confirming}
                            onClick={onConfirm}
                        >
                            Claim {item.rockAmount} quartz
                        </Button>
                    </Space>
                </div>
            )}
        </Card>
    );
};

export default PayRockPreviewCard;

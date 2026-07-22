import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Button, Card, Col, Empty, Row, Space, Table, Tag, Tooltip, Typography} from 'antd';
import {ClockCircleOutlined, DollarOutlined, StarFilled, StarOutlined, ThunderboltOutlined, TrophyOutlined, UserOutlined} from '@ant-design/icons';
import {useStorage} from '../../contexts/LocalStorageContext';
import {Line} from '@ant-design/charts';
import {motion} from 'framer-motion';
import {IActiveHero, IDailyEarning, IHeroInfo, IPendingReward, IWatchData, Network, RewardType} from './WatchData';
import {COLOR_STYLES, HERO_TYPE_TO_STR, NETWORK_TO_STR, NETWORK_TO_STR_DETAIL, RARITY_TO_STR} from '../../utils/ThModeV2Utils';
import WatchFetcher from './WatchFetcher';
import './WatchCard.css';

const {Title, Text} = Typography;

interface IProps {
    wallet: string;
}

const networkTag = (network: Network) => {
    const color = network === Network.BSC ? '#f0b90b' : '#8247e5';
    return <Tag color={color} className="watch-network-tag">{NETWORK_TO_STR_DETAIL[network]}</Tag>;
};

const rarityTag = (rarity: number) => (
    <Tag style={{...COLOR_STYLES[rarity], color: '#fff', border: 'none'}} className="watch-rarity-tag">
        {RARITY_TO_STR[rarity] ?? rarity}
    </Tag>
);

const STAGE_LABELS = ['Work', 'Sleep', 'In House'];
const stageLabel = (stage: number) => STAGE_LABELS[stage] ?? `Stage ${stage}`;

const fmt = (v: number): string => {
    if (!Number.isFinite(v)) return '0';
    if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
    return Math.round(v).toString();
};

const CurrentRaceSection: React.FC<{ raceId: number; heroes: IHeroInfo[] }> = ({raceId, heroes}) => {
    if (!heroes.length) {
        return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">Not in current race ({raceId})</Text>}/>;
    }
    return (
        <Table<IHeroInfo>
            dataSource={heroes}
            rowKey="uniqueKey"
            size="small"
            pagination={false}
            className="watch-table"
            columns={[
                {
                    title: 'Hero',
                    key: 'hero',
                    render: (_, r) => (
                        <Tooltip title={`Race #${r.raceId}`}>
                            <span>{`${NETWORK_TO_STR[r.network]}_${HERO_TYPE_TO_STR[r.heroType]}_${r.heroId}`}</span>
                        </Tooltip>
                    ),
                },
                {title: 'Pool', dataIndex: 'heroRarity', key: 'rarity', render: rarityTag},
                {title: 'Bcoin Stake', dataIndex: 'stakeBcoinFormatted', key: 'bcoin', align: 'right'},
                {title: 'Sen Stake', dataIndex: 'stakeSenFormatted', key: 'sen', align: 'right'},
                {title: 'Ticket', dataIndex: 'ticketCount', key: 'ticket', align: 'center'},
            ]}
        />
    );
};

const ActiveHeroesSection: React.FC<{ heroes: IActiveHero[] }> = ({heroes}) => {
    if (!heroes.length) {
        return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">No active heroes</Text>}/>;
    }
    return (
        <Table<IActiveHero>
            dataSource={heroes}
            rowKey={(r) => `${r.network}_${r.bomberId}`}
            size="small"
            pagination={{pageSize: 8, size: 'small', hideOnSinglePage: true}}
            className="watch-table"
            columns={[
                {title: 'Hero', dataIndex: 'bomberId', key: 'bomberId', render: (id: number, r) => `${NETWORK_TO_STR[r.network]}_${id}`},
                {title: 'Pool', dataIndex: 'rarity', key: 'rarity', render: rarityTag},
                {title: 'Stage', dataIndex: 'stage', key: 'stage', align: 'center', render: stageLabel},
                {title: 'Bcoin Stake', dataIndex: 'stakeBcoin', key: 'bcoin', align: 'right', render: fmt},
                {title: 'Sen Stake', dataIndex: 'stakeSen', key: 'sen', align: 'right', render: fmt},
                {title: 'Net', dataIndex: 'network', key: 'network', render: networkTag},
            ]}
        />
    );
};

const PendingRewardsSection: React.FC<{ rewards: IPendingReward[] }> = ({rewards}) => {
    if (!rewards.length) {
        return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">No pending rewards</Text>}/>;
    }
    // Group by reward_type × network for a compact display
    type Key = `${RewardType}_${Network}`;
    const map = new Map<Key, IPendingReward>();
    rewards.forEach(r => map.set(`${r.rewardType}_${r.network}`, r));

    const cells: { label: string; value: number; network: Network; rewardType: RewardType }[] = [];
    (['BCOIN', 'SENSPARK'] as RewardType[]).forEach(rt => {
        [Network.BSC, Network.POLYGON].forEach(net => {
            const found = map.get(`${rt}_${net}`);
            if (found && found.value > 0) {
                cells.push({label: rt, value: found.value, network: net, rewardType: rt});
            }
        });
    });

    if (!cells.length) {
        return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">No pending rewards</Text>}/>;
    }

    return (
        <Row gutter={[8, 8]}>
            {cells.map((c, idx) => (
                <Col xs={12} key={idx}>
                    <Card size="small" className="watch-pending-cell">
                        <Space size={6}>
                            {networkTag(c.network)}
                            <Text strong>{c.label}</Text>
                        </Space>
                        <div className="watch-pending-value">{fmt(c.value)}</div>
                    </Card>
                </Col>
            ))}
        </Row>
    );
};

type DailyChartRow = { date: string; series: 'BCOIN' | 'SEN'; value: number };

const DAILY_WINDOW_DAYS = 14;

const buildDailyRows = (daily: IDailyEarning[]): DailyChartRow[] => {
    const today = new Date();
    const days: string[] = [];
    for (let i = DAILY_WINDOW_DAYS - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
        days.push(d.toISOString().slice(0, 10));
    }
    const rows: DailyChartRow[] = [];
    days.forEach(date => {
        const matches = daily.filter(d => d.date === date);
        const bcoin = matches.reduce((s, d) => s + d.bcoin, 0);
        const sen = matches.reduce((s, d) => s + d.sen, 0);
        rows.push({date: date.slice(5), series: 'BCOIN', value: Math.round(bcoin * 100) / 100});
        rows.push({date: date.slice(5), series: 'SEN', value: Math.round(sen * 100) / 100});
    });
    return rows;
};

const dailySignature = (daily: IDailyEarning[]): string =>
    daily.map(d => `${d.date}|${d.network}|${d.bcoin}|${d.sen}`).join(';');

const DailyEarningsSectionInner: React.FC<{ daily: IDailyEarning[] }> = ({daily}) => {
    const rows = useMemo(() => buildDailyRows(daily), [daily]);

    if (!daily.length) {
        return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">No earnings in last {DAILY_WINDOW_DAYS} days</Text>}/>;
    }

    return (
        <div className="watch-chart-wrap">
            <Line
                data={rows}
                xField="date"
                yField="value"
                colorField="series"
                height={180}
                point={{shapeField: 'circle', sizeField: 3}}
                legend={{color: {position: 'top', layout: {justifyContent: 'center'}}}}
                axis={{
                    x: {labelFill: '#c7d0db', tickStroke: '#c7d0db'},
                    y: {labelFill: '#c7d0db', tickStroke: '#c7d0db'},
                }}
                scale={{color: {range: ['#ffd666', '#69b1ff']}}}
                style={{maxWidth: 600}}
            />
        </div>
    );
};

// Memoize: countdown state in WatchCard ticks every 500ms, re-rendering all
// sections. The chart only needs to re-mount when daily content actually
// changes — compare by content signature so the Line tooltip stays stable.
const DailyEarningsSection = React.memo(
    DailyEarningsSectionInner,
    (prev, next) => dailySignature(prev.daily) === dailySignature(next.daily),
);

const WatchCard: React.FC<IProps> = ({wallet}) => {
    const storage = useStorage();
    const [data, setData] = useState<IWatchData | null>(null);
    const [countdown, setCountdown] = useState<number>(0);
    const [isFavorite, setIsFavorite] = useState<boolean>(() => storage.isFavorite(wallet));
    const fetcher = useRef<WatchFetcher | undefined>(undefined);

    useEffect(() => {
        setIsFavorite(storage.isFavorite(wallet));
        fetcher.current = new WatchFetcher(wallet, setData, setCountdown);
        fetcher.current.start();
        return () => fetcher.current?.destroy();
    }, [wallet, storage]);

    const handleToggleFavorite = () => {
        const next = storage.toggleFavorite(wallet);
        setIsFavorite(next);
    };

    return (
        <motion.div
            initial={{opacity: 0, y: 12}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.3}}
            className="watch-card"
        >
            <Card
                bordered={false}
                className="watch-card-inner"
                title={
                    <div className="watch-card-header">
                        <Space size={8} wrap>
                            <UserOutlined style={{color: '#40a9ff'}}/>
                            <Text className="watch-card-username" strong>{data?.userName ?? '...'}</Text>
                            <Tooltip title={wallet}>
                                <Text className="watch-card-wallet" type="secondary">
                                    {wallet.length > 14 ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : wallet}
                                </Text>
                            </Tooltip>
                        </Space>
                        <Space size={8}>
                            <Text type="secondary" className="watch-card-countdown">
                                <ClockCircleOutlined/> {countdown}s
                            </Text>
                            <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                                <Button
                                    size="small"
                                    type="text"
                                    className="watch-favorite-btn"
                                    icon={isFavorite ? <StarFilled style={{color: '#fadb14'}}/> : <StarOutlined style={{color: '#c7d0db'}}/>}
                                    onClick={handleToggleFavorite}
                                />
                            </Tooltip>
                        </Space>
                    </div>
                }
            >
                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={12}>
                        <div className="watch-section">
                            <Title level={5} className="watch-section-title">
                                <TrophyOutlined/> Current Race
                                {data?.currentRace?.raceId ? <Text type="secondary"> #{data.currentRace.raceId}</Text> : null}
                            </Title>
                            <CurrentRaceSection
                                raceId={data?.currentRace?.raceId ?? 0}
                                heroes={data?.currentRace?.heroes ?? []}
                            />
                        </div>
                    </Col>
                    <Col xs={24} lg={12}>
                        <div className="watch-section">
                            <Title level={5} className="watch-section-title">
                                <ThunderboltOutlined/> Active Heroes
                                {data?.activeHeroes ? <Text type="secondary"> ({data.activeHeroes.length})</Text> : null}
                            </Title>
                            <ActiveHeroesSection heroes={data?.activeHeroes ?? []}/>
                        </div>
                    </Col>
                    <Col xs={24} lg={12}>
                        <div className="watch-section">
                            <Title level={5} className="watch-section-title">
                                <DollarOutlined/> Claimable Rewards
                            </Title>
                            <PendingRewardsSection rewards={data?.pendingRewards ?? []}/>
                        </div>
                    </Col>
                    <Col xs={24} lg={12}>
                        <div className="watch-section">
                            <Title level={5} className="watch-section-title">
                                <DollarOutlined/> Daily Earnings ({DAILY_WINDOW_DAYS}d)
                            </Title>
                            <DailyEarningsSection daily={data?.dailyEarnings ?? []}/>
                        </div>
                    </Col>
                </Row>
            </Card>
        </motion.div>
    );
};

export default WatchCard;

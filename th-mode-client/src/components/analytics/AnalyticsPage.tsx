import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
    Table, Card, Row, Col, Typography, Spin, Tag, Statistic, 
    Input, Select, Space, Tooltip, Button, Avatar, List 
} from 'antd';
import { 
    ArrowUpOutlined, SearchOutlined, SwapOutlined, 
    TrophyOutlined, UserOutlined, StarOutlined, HomeOutlined,
    GlobalOutlined, RocketOutlined, FireOutlined
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const { Title, Text } = Typography;

/**
 * @interface NFTData
 * @description Represents the return payload of NFT metadata from the analytics engine.
 */
interface NFTData {
    id: string;
    token_id: string;
    network: string;
    contract_address: string;
    metadata: {
        attributes?: { trait_type: string; value: string | number }[];
        name?: string;
        image?: string;
    };
    owner_address: string;
    last_update_block: string;
}

interface RankingStaker {
    wallet: string;
    heroCount?: string;
    amount?: string;
    totalAmount?: string;
}

const HERO_RARITY_ARRAY = ['Common', 'Rare', 'Super Rare', 'Epic', 'Legend', 'Super Legend'];
const HERO_COLORS = ['#d5d5d5', '#3bca22', '#a507ff', '#ff00ee', '#ffc107', '#ff0759'];

const resolveRarityIndex = (record: NFTData): number => {
    const rarityAttr = record.metadata?.attributes?.find(a => a.trait_type === 'Rarity');
    if (!rarityAttr) return 0;
    const idx = HERO_RARITY_ARRAY.indexOf(String(rarityAttr.value));
    return idx >= 0 ? idx : 0;
};

const AnalyticsPage: React.FC = () => {
    const { view } = useParams<{ view: string }>();
    const [data, setData] = useState<NFTData[]>([]);
    const [rankingData, setRankingData] = useState<RankingStaker[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchTokenId, setSearchTokenId] = useState<string>('');
    const [searchWallet, setSearchWallet] = useState<string>('');
    const [selectedNetwork, setSelectedNetwork] = useState<string>('all');
    const [selectedToken, setSelectedToken] = useState<string>('bcoin');
    const [stats, setStats] = useState({ 
        totalBsc: 0, 
        totalPolygon: 0,
        totalAssets: 0,
        stakedBcoin: 0,
        stakedSens: 0
    });

    // SEO and Dynamic Title
    useEffect(() => {
        const pageTitle = view ? `${view.charAt(0).toUpperCase() + view.slice(1).replace(/-/g, ' ')} | BombStats Analytics` : 'Dashboard | BombStats Analytics';
        document.title = pageTitle;
        
        // Meta description update (simplified)
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', `BombStats Official Analytics - Viewing ${view}. Real-time tracking of BombCrypto assets, rankings, and staking metrics.`);
        }
    }, [view]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (view === 'ranking-stakers') {
                const response = await axios.get('/analytics-api/nfts/ranking/stakers');
                setRankingData(response.data);
            } else if (view === 'ranking-stake' || view === 'ranking-stake-wallet') {
                const response = await axios.get('/analytics-api/nfts/ranking/stake', {
                    params: { token: selectedToken, network: selectedNetwork }
                });
                setRankingData(response.data);
            } else if (view === 'ranking-global-stake' || view === 'ranking-global-stake-wallet') {
                const response = await axios.get('/analytics-api/nfts/ranking/global-stake');
                setRankingData(response.data);
            } else if (view === 'ranking-claim') {
                const response = await axios.get('/analytics-api/nfts/ranking/claim', {
                    params: { token: selectedToken, network: selectedNetwork }
                });
                setRankingData(response.data);
            } else {
                // Asset Feeds (Wallet, Hero, House, Market)
                const params: any = { limit: 50 };
                if (selectedNetwork !== 'all') params.network = selectedNetwork;
                if (searchWallet.trim()) params.owner = searchWallet.trim();

                const response = await axios.get('/analytics-api/nfts', { params });
                let items = response.data.data || [];
                
                // Specific Filtering logic for "Ghost Pages"
                if (view === 'hero') {
                    items = items.filter((it: any) => it.metadata?.name?.toLowerCase().includes('hero') || it.metadata?.attributes?.some((a: any) => a.trait_type === 'Rarity'));
                } else if (view === 'house') {
                    items = items.filter((it: any) => it.metadata?.name?.toLowerCase().includes('house'));
                }
                
                setData(items);

                const summaryRes = await axios.get('/analytics-api/nfts/overview-stats');
                setStats({ 
                    totalBsc: summaryRes.data.totalBscNfts, 
                    totalPolygon: summaryRes.data.totalPolygonNfts,
                    totalAssets: summaryRes.data.totalAssets,
                    stakedBcoin: summaryRes.data.totalStakedBcoin,
                    stakedSens: summaryRes.data.totalStakedSens
                });
            }
        } catch (error) {
            console.error('Analytics Fetch Error:', error);
        } finally {
            setLoading(false);
        }
    }, [view, selectedNetwork, selectedToken, searchWallet]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredData = useMemo(() => {
        let result = data;
        if (searchTokenId.trim()) {
            result = result.filter(item => item.token_id?.includes(searchTokenId.trim()));
        }
        return result;
    }, [data, searchTokenId]);

    const columns: ColumnsType<NFTData> = [
        {
            title: 'TOKEN ID',
            dataIndex: 'token_id',
            key: 'token_id',
            render: (text) => <Text strong style={{ color: '#e3b341', fontFamily: 'monospace' }}>#{text}</Text>,
        },
        {
            title: 'NETWORK',
            dataIndex: 'network',
            key: 'network',
            render: (net) => (
                <Tag color={net === 'bsc' ? '#f3ba2f' : '#8247e5'} style={{ borderRadius: '4px', border: 'none', fontWeight: 700 }}>
                    {net?.toUpperCase()}
                </Tag>
            ),
        },
        {
            title: 'OWNER ADDRESS',
            dataIndex: 'owner_address',
            key: 'owner_address',
            render: (address) => (
                <Tooltip title={address}>
                    <Text copyable style={{ color: '#8b949e', fontFamily: 'monospace' }}>{address?.slice(0, 8)}...{address?.slice(-6)}</Text>
                </Tooltip>
            ),
        },
        {
            title: 'RARITY / TYPE',
            key: 'rarity',
            render: (_, record) => {
                const idx = resolveRarityIndex(record);
                const isHouse = record.metadata?.name?.toLowerCase().includes('house');
                return (
                    <Tag style={{ 
                        background: isHouse ? '#444' : HERO_COLORS[idx], 
                        border: 'none', 
                        color: (idx === 0 && !isHouse) ? '#333' : '#fff', 
                        fontWeight: 800,
                        padding: '2px 12px'
                    }}>
                        {isHouse ? 'HOUSE' : HERO_RARITY_ARRAY[idx].toUpperCase()}
                    </Tag>
                );
            }
        },
        {
            title: 'LAST UPDATED',
            dataIndex: 'last_update_block',
            key: 'block',
            render: (block) => <Text style={{ color: '#58a6ff' }}>Block {Number(block).toLocaleString()}</Text>,
        }
    ];

    const renderOverview = () => (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
                <Col xs={24} lg={14}>
                    <Card 
                        title={<Space><GlobalOutlined style={{ color: '#e3b341' }} /> <Text strong style={{ color: '#fff' }}>Market Ecosystem</Text></Space>} 
                        style={{ background: 'linear-gradient(145deg, #1d1d1d, #111111)', border: '1px solid #333', borderRadius: '16px' }}
                    >
                        <Row gutter={[16, 16]}>
                            {[
                                { name: 'BCOIN', net: 'POLYGON', price: '0.007518', up: true, perc: '2.52', color: '#8247e5' },
                                { name: 'BCOIN', net: 'BSC', price: '0.004746', up: true, perc: '1.16', color: '#f3ba2f' },
                                { name: 'SENS', net: 'POLYGON', price: '0.000493', up: true, perc: '1.60', color: '#8247e5' },
                                { name: 'SENS', net: 'BSC', price: '0.000807', up: false, perc: '0.88', color: '#f3ba2f' },
                            ].map((token, i) => (
                                <Col span={12} key={i}>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Tag color={token.color} style={{ fontSize: '10px', border: 'none' }}>{token.net}</Tag>
                                            <Text style={{ color: token.up ? '#3fb950' : '#ff4d4f', fontSize: '12px', fontWeight: 'bold' }}>{token.up ? '▲' : '▼'} {token.perc}%</Text>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                            <Text style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{token.name}</Text>
                                            <Title level={3} style={{ color: '#e3b341', margin: 0 }}>${token.price}</Title>
                                        </div>
                                    </div>
                                </Col>
                            ))}
                        </Row>
                    </Card>
                </Col>
                <Col xs={24} lg={10}>
                    <Card 
                        title={<Space><FireOutlined style={{ color: '#ff4d4f' }} /> <Text strong style={{ color: '#fff' }}>Protocol TVL</Text></Space>} 
                        style={{ background: 'linear-gradient(145deg, #1d1d1d, #111111)', border: '1px solid #333', borderRadius: '16px', height: '100%' }}
                    >
                        <Space direction="vertical" size="large" style={{ width: '100%' }}>
                            <div style={{ padding: '20px', background: 'rgba(227, 179, 65, 0.05)', borderRadius: '12px', borderLeft: '4px solid #e3b341' }}>
                                <Statistic title={<Text style={{ color: '#8b949e', fontSize: '14px' }}>TOTAL BCOIN STAKED</Text>} value={stats.stakedBcoin} precision={2} valueStyle={{ color: '#e3b341', fontWeight: 800, fontSize: '28px' }} suffix={<Text style={{ color: '#e3b341', fontSize: '16px' }}>BCOIN</Text>} />
                            </div>
                            <div style={{ padding: '20px', background: 'rgba(255, 77, 79, 0.05)', borderRadius: '12px', borderLeft: '4px solid #ff4d4f' }}>
                                <Statistic title={<Text style={{ color: '#8b949e', fontSize: '14px' }}>TOTAL SENS STAKED</Text>} value={stats.stakedSens} precision={2} valueStyle={{ color: '#ff4d4f', fontWeight: 800, fontSize: '28px' }} suffix={<Text style={{ color: '#ff4d4f', fontSize: '16px' }}>SENS</Text>} />
                            </div>
                        </Space>
                    </Card>
                </Col>
            </Row>

            <Row gutter={[24, 24]}>
                {[
                    { title: 'BSC NETWORK', value: stats.totalBsc, color: '#f3ba2f', icon: <RocketOutlined /> },
                    { title: 'POLYGON NETWORK', value: stats.totalPolygon, color: '#8247e5', icon: <GlobalOutlined /> },
                    { title: 'TOTAL ASSETS', value: stats.totalAssets, color: '#e3b341', icon: <AppstoreOutlined /> },
                ].map((item, i) => (
                    <Col xs={24} md={8} key={i}>
                        <Card style={{ background: '#1d1d1d', border: 'none', borderRadius: '16px', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', right: -10, bottom: -10, fontSize: '64px', opacity: 0.1, color: item.color }}>{item.icon}</div>
                            <Statistic title={<Text style={{ color: '#8b949e', fontWeight: 600 }}>{item.title}</Text>} value={item.value} valueStyle={{ color: item.color, fontWeight: 800, fontSize: '32px' }} />
                        </Card>
                    </Col>
                ))}
            </Row>
        </motion.div>
    );

    const renderRanking = (title: string, icon: React.ReactNode, valueField: keyof RankingStaker, label: string) => (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <Card style={{ background: '#161b22', borderColor: '#333', marginBottom: 24, borderRadius: '12px' }}>
                <Space size="middle">
                    <Select value={selectedNetwork} onChange={setSelectedNetwork} style={{ width: 180 }} className="custom-select" options={[{label:'All Networks', value:'all'},{label:'BSC', value:'bsc'},{label:'Polygon', value:'polygon'}]} />
                    <Select value={selectedToken} onChange={setSelectedToken} style={{ width: 140 }} className="custom-select" options={[{label:'BCOIN', value:'bcoin'},{label:'SENS', value:'sens'}]} />
                    <Button icon={<SwapOutlined />} onClick={() => fetchData()}>Refresh</Button>
                </Space>
            </Card>
            <Card 
                title={<Space><div style={{ background: '#e3b341', padding: '8px', borderRadius: '8px' }}>{icon}</div> <Title level={4} style={{ color: '#fff', margin: 0 }}>{title}</Title></Space>}
                style={{ background: '#111', border: '1px solid #333', borderRadius: '16px', overflow: 'hidden' }}
                bodyStyle={{ padding: 0 }}
            >
                <List
                    loading={loading}
                    dataSource={rankingData}
                    renderItem={(item, index) => (
                        <List.Item style={{ borderBottom: '1px solid #222', padding: '20px 24px', transition: 'all 0.3s' }} className="ranking-item">
                            <List.Item.Meta
                                avatar={
                                    <Avatar 
                                        size={40}
                                        style={{ 
                                            backgroundColor: index === 0 ? '#e3b341' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#262626',
                                            color: index < 3 ? '#000' : '#fff',
                                            fontWeight: 800,
                                            boxShadow: index < 3 ? `0 0 15px ${index === 0 ? '#e3b341' : index === 1 ? '#c0c0c0' : '#cd7f32'}44` : 'none'
                                        }}
                                    >
                                        {index + 1}
                                    </Avatar>
                                }
                                title={<Text strong style={{ color: '#fff', fontSize: '16px', fontFamily: 'monospace' }}>{item.wallet}</Text>}
                                description={<Space><UserOutlined style={{ color: '#8b949e' }} /> <Text style={{ color: '#444' }}>VERIFIED HOLDER</Text></Space>}
                            />
                            <div style={{ textAlign: 'right' }}>
                                <Text style={{ color: '#8b949e', fontSize: '12px', display: 'block' }}>{label.toUpperCase()}</Text>
                                <Title level={3} style={{ color: index < 3 ? '#e3b341' : '#58a6ff', margin: 0, fontWeight: 800 }}>
                                    {Number(item[valueField] || 0).toLocaleString()}
                                </Title>
                            </div>
                        </List.Item>
                    )}
                />
            </Card>
        </motion.div>
    );

    const renderAssetFeed = () => (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
            <Card style={{ background: '#161b22', borderColor: '#333', marginBottom: 24, borderRadius: '12px' }}>
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} md={6}>
                        <Select value={selectedNetwork} onChange={setSelectedNetwork} style={{ width: '100%' }} options={[{label:'Global View', value:'all'},{label:'Binance Smart Chain', value:'bsc'},{label:'Polygon Network', value:'polygon'}]} />
                    </Col>
                    <Col xs={24} md={10}>
                        <Input.Search placeholder="Search by Wallet Address (0x...)" onSearch={setSearchWallet} style={{ width: '100%' }} allowClear enterButton={<SearchOutlined />} />
                    </Col>
                    <Col xs={24} md={8}>
                        <Input placeholder="Direct Token ID Lookup..." value={searchTokenId} onChange={e => setSearchTokenId(e.target.value)} prefix={<RocketOutlined style={{ color: '#e3b341' }} />} allowClear />
                    </Col>
                </Row>
            </Card>
            <Table 
                columns={columns} 
                dataSource={filteredData} 
                rowKey="id" 
                loading={loading} 
                size="middle" 
                pagination={{ pageSize: 12, showSizeChanger: false }} 
                className="custom-table"
            />
        </motion.div>
    );

    return (
        <div style={{ padding: '40px', background: '#0a0a0a', minHeight: '100vh', color: '#fff' }}>
            <div style={{ marginBottom: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                        <Title level={1} style={{ color: '#fff', margin: 0, fontWeight: 900, letterSpacing: '-1px', fontSize: '56px', lineHeight: 1 }}>
                            {view?.replace(/-/g, ' ').toUpperCase() || 'DASHBOARD'}
                        </Title>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                            <div style={{ height: '2px', width: '40px', background: '#e3b341' }}></div>
                            <Text style={{ color: '#e3b341', fontWeight: 800, letterSpacing: '3px', fontSize: '12px' }}>OFFICIAL ANALYTICS ENGINE</Text>
                        </div>
                    </motion.div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <Text style={{ color: '#444', fontSize: '12px' }}>DATA REFRESH RATE: 15S</Text>
                </div>
            </div>

            <AnimatePresence mode="wait">
                <div key={view}>
                    {view === 'overview' && renderOverview()}
                    {view === 'ranking-stakers' && renderRanking('Top Hero Stakers', <TrophyOutlined style={{ color: '#000' }} />, 'heroCount', 'Heroes Owned')}
                    {(view === 'ranking-stake' || view === 'ranking-stake-wallet') && renderRanking('Top Wallet Stakes', <SwapOutlined style={{ color: '#000' }} />, 'amount', 'Total Staked')}
                    {(view === 'ranking-global-stake' || view === 'ranking-global-stake-wallet') && renderRanking('Global Wallet Stakes', <SwapOutlined style={{ color: '#000' }} />, 'totalAmount', 'Total Global Stake')}
                    {view === 'ranking-claim' && renderRanking('Top Claimers', <ArrowUpOutlined style={{ color: '#000' }} />, 'amount', 'Total Claimed')}
                    {['wallet', 'hero', 'house', 'market'].includes(view || '') && renderAssetFeed()}
                </div>
            </AnimatePresence>

            <style>{`
                .ant-table { background: transparent !important; color: #fff !important; }
                .ant-table-thead > tr > th { background: #111 !important; color: #8b949e !important; border-bottom: 2px solid #222 !important; font-size: 11px; letter-spacing: 1px; }
                .ant-table-tbody > tr > td { border-bottom: 1px solid #222 !important; padding: 16px !important; }
                .ant-table-row:hover > td { background: #1a1a1a !important; }
                .ant-pagination-item { background: #111 !important; border-color: #333 !important; }
                .ant-pagination-item a { color: #8b949e !important; }
                .ant-pagination-item-active { border-color: #e3b341 !important; background: #e3b341 !important; }
                .ant-pagination-item-active a { color: #000 !important; }
                .ranking-item:hover { background: #1a1a1a !important; cursor: pointer; transform: scale(1.005); }
                .custom-select .ant-select-selector { background: #111 !important; border-color: #333 !important; color: #fff !important; }
                .ant-statistic-title { color: #8b949e !important; font-weight: 600 !important; }
            `}</style>
        </div>
    );
};

export default AnalyticsPage;

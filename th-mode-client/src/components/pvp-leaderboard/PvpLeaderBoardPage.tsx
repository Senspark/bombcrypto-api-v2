import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Select, Space, Tabs, Typography, Badge, Tag } from 'antd';
import { CrownOutlined, TrophyOutlined, FireOutlined, GlobalOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import PvpLeaderBoardFetcher, { IPvpRanking } from './PvpLeaderBoardFetcher';
import PvpLeaderBoardTable from './PvpLeaderBoardTable';
import { NETWORK_TO_STR_DROPDOWN } from "../../utils/ThModeV2Utils";
import AutoRefreshToggle from "../leaderboard/AutoRefreshToggle";

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const PvpLeaderBoardPage = () => {
    document.title = 'Bombcrypto - PVP Leaderboard';

    const [weeklyData, setWeeklyData] = useState<IPvpRanking[]>([]);
    const [monthlyData, setMonthlyData] = useState<IPvpRanking[]>([]);
    const [hallOfFame, setHallOfFame] = useState<{winners: any[], bettors: any[]}>({winners: [], bettors: []});
    const [modeFilter, setModeFilter] = useState("ALL");
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchData = async () => {
        const weekly = await PvpLeaderBoardFetcher.getWeekly(modeFilter);
        const monthly = await PvpLeaderBoardFetcher.getMonthly(modeFilter);
        const topWinners = await PvpLeaderBoardFetcher.getHallOfFame('winners');
        const topBettors = await PvpLeaderBoardFetcher.getHallOfFame('bettors');
        
        setWeeklyData(weekly);
        setMonthlyData(monthly);
        setHallOfFame({winners: topWinners, bettors: topBettors});
    };

    useEffect(() => {
        fetchData();
        let interval: any;
        if (autoRefresh) {
            interval = setInterval(fetchData, 10000);
        }
        return () => clearInterval(interval);
    }, [modeFilter, autoRefresh]);

    return (
        <div className="leaderboard-container" style={{ padding: '24px' }}>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{ textAlign: 'center', marginBottom: '32px' }}
            >
                <Title level={1}>
                    <TrophyOutlined style={{ marginRight: '16px', color: '#faad14' }} />
                    PVP Leaderboard
                    <FireOutlined style={{ marginLeft: '16px', color: '#ff4d4f' }} />
                </Title>
                <Text type="secondary">Compete with the best and climb the ranks!</Text>
            </motion.div>

            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                <Col xs={24} md={12} lg={8}>
                    <Card className="boxStyle" bordered={false}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Text strong>Game Mode</Text>
                            <Select 
                                value={modeFilter} 
                                onChange={setModeFilter} 
                                style={{ width: '100%' }}
                            >
                                <Option value="ALL">All Modes</Option>
                                <Option value="1V1">1v1 Duel</Option>
                                <Option value="2V2">2v2 Team</Option>
                                <Option value="3V3">3v3 Team</Option>
                                <Option value="BR6P">Battle Royale</Option>
                            </Select>
                        </Space>
                    </Card>
                </Col>
                <Col xs={24} md={12} lg={8}>
                    <Card className="boxStyle" bordered={false}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Text strong>Network Filter</Text>
                            <Select defaultValue="all" style={{ width: '100%' }}>
                                <Option value="all">All Networks</Option>
                                {Object.entries(NETWORK_TO_STR_DROPDOWN).map(([key, value]) => (
                                    <Option key={key} value={key}>{value}</Option>
                                ))}
                            </Select>
                        </Space>
                    </Card>
                </Col>
                <Col xs={24} md={24} lg={8}>
                    <Card className="boxStyle" bordered={false} style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        <AutoRefreshToggle onToggle={setAutoRefresh} toggleDefaultState={true} />
                    </Card>
                </Col>
            </Row>

            <Card bordered={false} style={{ borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <Tabs defaultActiveKey="1" size="large" animated={{ inkBar: true, tabPane: true }}>
                    <TabPane 
                        tab={<span><CrownOutlined /> Weekly Ranking</span>} 
                        key="1"
                    >
                        <PvpLeaderBoardTable data={weeklyData} type="weekly" />
                    </TabPane>
                    <TabPane 
                        tab={<span><TrophyOutlined /> Monthly Ranking</span>} 
                        key="2"
                    >
                        <PvpLeaderBoardTable data={monthlyData} type="monthly" />
                    </TabPane>
                    <TabPane 
                        tab={<span><FireOutlined /> Hall of Fame</span>} 
                        key="3"
                    >
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Title level={4}>Top Winners</Title>
                                <PvpLeaderBoardTable data={hallOfFame.winners} type="hall-winners" />
                            </Col>
                            <Col span={12}>
                                <Title level={4}>Top Bettors</Title>
                                <PvpLeaderBoardTable data={hallOfFame.bettors} type="hall-bettors" />
                            </Col>
                        </Row>
                    </TabPane>
                </Tabs>
            </Card>
        </div>
    );
};

export default PvpLeaderBoardPage;

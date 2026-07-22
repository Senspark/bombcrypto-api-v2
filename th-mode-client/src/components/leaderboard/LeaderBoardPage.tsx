import React, {useEffect, useRef, useState} from 'react';
import './LeaderBoardPage.css';
import GroupedPoolTable from "./PoolTable";
import RewardPoolPanel from "./RewardPoolPanel";
import {IFetchedData, Network} from "./LeaderBoardData";
import AutoRefreshToggle from "./AutoRefreshToggle";
import LeaderBoardFetcher from "./LeaderBoardFetcher";
import {Button, Card, Col, Drawer, Progress, Row, Select, Space, Switch, Typography} from 'antd';
import {COLOR_STYLES, NETWORK_TO_STR_DROPDOWN, RARITY_TO_STR} from "../../utils/ThModeV2Utils";
import {useStorage} from "../../contexts/LocalStorageContext";
import {motion} from 'framer-motion';
import {
    BankOutlined,
    ClockCircleOutlined,
    CrownOutlined,
    EyeInvisibleOutlined,
    EyeOutlined,
    GlobalOutlined,
    TrophyOutlined
} from '@ant-design/icons';

const {Title, Text} = Typography;
const {Option} = Select;
const AUTO_REFRESH_DEFAULT_STATE = true;
const REFRESH_INTERVAL = 5; // seconds

const LeaderBoardPage = () => {
    document.title = 'Bombcrypto - Treasure Mode Race';

    const nullFetchedData: IFetchedData = {
        raceId: 0,
        groupedData: []
    };

    const localStorage = useStorage();
    const [data, setData] = useState<IFetchedData>(nullFetchedData);
    const [autoRefresh, setAutoRefresh] = useState(AUTO_REFRESH_DEFAULT_STATE);
    const [timeCountDown, setTimeCountDown] = useState(0);
    const fetcher = useRef<LeaderBoardFetcher | undefined>(undefined);
    const [tableVisible, setTableVisible] = useState<boolean[]>(localStorage.getQueuePoolVisibilities());
    const [networkFilter, setNetworkFilter] = useState<Network | undefined>(undefined);
    const [showNetworkRowColor] = useState<boolean>(false);
    const [rewardPoolsOpen, setRewardPoolsOpen] = useState(false);

    const onDataFetched = (data: IFetchedData) => setData(data);
    const onTimeCountDown = (timeLeft: number) => setTimeCountDown(timeLeft);

    useEffect(() => {
        if (autoRefresh) {
            fetcher.current?.start();
        } else {
            fetcher.current?.stop();
        }
    }, [autoRefresh]);

    useEffect(() => {
        fetcher.current = new LeaderBoardFetcher(onDataFetched, onTimeCountDown);
        fetcher.current.start();

        return () => {
            fetcher.current?.destroy();
        };
    }, []);

    const handleAutoRefreshChange = (isToggled: boolean) => {
        setAutoRefresh(isToggled);
    }

    const handleSwitchChange = (checked: boolean, switchName: string) => {
        const newTableVisible = [...tableVisible];
        const index = RARITY_TO_STR.indexOf(switchName);
        newTableVisible[index] = checked;
        localStorage.setQueuePoolVisibilities(newTableVisible);
        setTableVisible(newTableVisible);
    }

    const handleNetworkFilterChange = (value: Network | null) => {
        setNetworkFilter(value === null ? undefined : value);
    };

    // Ensure groupedData has an array for each rarity, even if empty
    const fullGroupedData = Array.from({length: RARITY_TO_STR.length}, (_, idx) =>
        data.groupedData[idx] || []
    );

    // Calculate total hero count
    const totalHeroes = fullGroupedData.reduce((total, group, index) => {
        return total + (tableVisible[index] ? group.length : 0);
    }, 0);

    // Progress bar calculation
    const progressPercent = Math.max(0, Math.min(100, (timeCountDown / REFRESH_INTERVAL) * 100));

    const switches = RARITY_TO_STR.map((it, idx) => {
        const iconStyle = {marginRight: '4px'};
        return (
            <Switch
                checkedChildren={<><EyeOutlined style={iconStyle}/>{it}</>}
                unCheckedChildren={<><EyeInvisibleOutlined style={iconStyle}/>{it}</>}
                key={it}
                onChange={(checked) => handleSwitchChange(checked, it)}
                defaultChecked={tableVisible[idx]}
                className="rarity-switch"
                style={{
                    '--switch-color': COLOR_STYLES[idx].background
                } as React.CSSProperties}
            />
        );
    });

    return (
        <div className="leaderboard-container">
            <motion.div
                initial={{opacity: 0, y: -20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.5}}
                className="page-title-container"
            >
                <Title className="page-title">
                    <CrownOutlined style={{marginRight: '12px', color: '#ffd700'}}/>
                    Treasure Mode Race
                    <CrownOutlined style={{marginLeft: '12px', color: '#ffd700'}}/>
                </Title>
                <Text className="page-subtitle"></Text>
            </motion.div>

            <motion.div
                initial={{opacity: 0, y: -20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.5, delay: 0.1}}
                className="header-section"
            >
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} md={8} lg={6}>
                        <Card className="boxStyle" bordered={false}>
                            <Space>
                                <TrophyOutlined style={{fontSize: '24px', color: '#1890ff'}}/>
                                <div>
                                    <Text type="secondary">Current Race</Text>
                                    <Title level={4} className="race-id" style={{margin: 0}}>{data.raceId}</Title>
                                </div>
                            </Space>
                        </Card>
                    </Col>
                    <Col xs={24} md={8} lg={6}>
                        <Card className="boxStyle" bordered={false}>
                            <div className="countdown-container">
                                <Space>
                                    <ClockCircleOutlined style={{fontSize: '24px', color: '#ff4d4f'}}/>
                                    <div>
                                        <div className="countdown-text">
                                            <Text type="secondary">Next Update</Text>
                                            <Title level={4} className="countdown-timer" style={{margin: 0}}>
                                                {timeCountDown}s
                                            </Title>
                                        </div>
                                    </div>
                                </Space>
                                <Progress
                                    percent={progressPercent}
                                    showInfo={false}
                                    size="small"
                                    strokeColor={{
                                        '0%': '#ff4d4f',
                                        '100%': '#1890ff',
                                    }}
                                    style={{marginTop: '8px'}}
                                />
                            </div>
                        </Card>
                    </Col>
                    <Col xs={24} md={8} lg={6}>
                        <Card className="boxStyle" bordered={false}>
                            <AutoRefreshToggle className="auto-refresh-toggle"
                                               toggleDefaultState={AUTO_REFRESH_DEFAULT_STATE}
                                               onToggle={handleAutoRefreshChange}/>
                        </Card>
                    </Col>
                    <Col xs={24} lg={6}>
                        <Card className="boxStyle" bordered={false}>
                            <Text type="secondary">Visible Heroes: <Text strong>{totalHeroes}</Text></Text>
                        </Card>
                    </Col>
                </Row>

                <Row align="middle" justify="space-between" style={{margin: '16px 0 8px'}}>
                    <Col>
                        <Text strong>Pool Visibility</Text>
                    </Col>
                    <Col>
                        <Text strong>Network</Text>
                    </Col>
                </Row>

                <Row gutter={[16, 16]}>
                    <Col flex="auto">
                        <div className="switches-container">
                            {switches}
                        </div>
                    </Col>
                    <Col style={{display: 'flex', justifyContent: 'flex-end'}}>
                        <Space>
                            <Select
                                value={networkFilter === undefined ? "all" : networkFilter}
                                onChange={(value) => handleNetworkFilterChange(value === "all" ? null : value as Network)}
                                style={{width: 160}}
                                className="network-filter-select"
                                dropdownStyle={{borderRadius: '8px'}}
                                suffixIcon={<GlobalOutlined style={{color: '#1890ff'}}/>}
                            >
                                <Option key="all" value="all">
                                    <Space>
                                        <GlobalOutlined style={{color: '#1890ff'}}/>
                                        <span>All networks</span>
                                    </Space>
                                </Option>
                                {Object.entries(NETWORK_TO_STR_DROPDOWN).map(([key, value]) => (
                                    <Option key={key} value={parseInt(key)}>
                                        <Space>
                                            <GlobalOutlined style={{color: value === 'Bsc' ? '#f0b90b' : '#8247e5'}}/>
                                            <span>{value}</span>
                                        </Space>
                                    </Option>
                                ))}
                            </Select>
                            <Button
                                type="primary"
                                icon={<BankOutlined/>}
                                onClick={() => setRewardPoolsOpen(true)}
                            >
                                Reward Pools
                            </Button>
                        </Space>
                    </Col>
                </Row>


            </motion.div>

            <GroupedPoolTable
                groupedData={fullGroupedData}
                tablesVisible={tableVisible}
                networkFilter={networkFilter}
                showNetworkRowColor={showNetworkRowColor}
            />

            <Drawer
                title="Reward Pools"
                placement="right"
                open={rewardPoolsOpen}
                onClose={() => setRewardPoolsOpen(false)}
                rootClassName="reward-pool-drawer"
                width={360}
            >
                <RewardPoolPanel rewardPools={data.rewardPools}/>
            </Drawer>
        </div>
    );
}

export default LeaderBoardPage;

import { Navigate, Route, Routes, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Avatar } from 'antd';
import { 
    HomeOutlined, 
    WalletOutlined, 
    ShopOutlined, 
    BarChartOutlined, 
    StarOutlined,
    AppstoreOutlined,
    DashboardOutlined,
    LineChartOutlined,
    TrophyOutlined
} from '@ant-design/icons';
import LeaderBoardPage from "../leaderboard/LeaderBoardPage";
import AnalyticsPage from "../analytics/AnalyticsPage";

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

/**
 * @description Roteamento principal do cliente Treasure Hunt Mode.
 * Refatorado para Sider vertical profissional seguindo o padrão BombStats.
 */
const MainNavigation = () => {
    const location = useLocation();

    // Mapping current path to menu keys
    const selectedKey = location.pathname.split('/').pop() || 'overview';

    return (
        <Layout style={{ minHeight: '100vh', background: '#0a0a0a' }}>
            <Sider
                width={260}
                theme="dark"
                style={{
                    background: '#111111',
                    borderRight: '1px solid #222',
                    position: 'fixed',
                    height: '100vh',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    zIndex: 1000
                }}
            >
                <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.2)' }}>
                    <Avatar 
                        src="https://bombcrypto.io/wp-content/uploads/2021/09/Logo-1.png" 
                        size={64} 
                        style={{ border: '2px solid #e3b341', background: 'transparent' }}
                    />
                    <div>
                        <Title level={4} style={{ color: '#fff', margin: 0, fontSize: '18px', fontWeight: '800' }}>BOMBSTATS</Title>
                        <Text style={{ color: '#e3b341', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Official Analytics</Text>
                    </div>
                </div>

                <Menu
                    mode="inline"
                    theme="dark"
                    selectedKeys={[selectedKey]}
                    defaultOpenKeys={['explore', 'rankings']}
                    style={{ background: 'transparent', borderRight: 0 }}
                    items={[
                        {
                            key: 'overview-grp',
                            label: 'OVERVIEW',
                            type: 'group',
                            children: [
                                {
                                    key: 'overview',
                                    icon: <HomeOutlined />,
                                    label: <Link to="/analytics/overview">Home</Link>,
                                },
                            ],
                        },
                        {
                            key: 'explore',
                            label: 'EXPLORE',
                            icon: <AppstoreOutlined />,
                            children: [
                                {
                                    key: 'wallet',
                                    icon: <WalletOutlined />,
                                    label: <Link to="/analytics/wallet">Wallet</Link>,
                                },
                                {
                                    key: 'house',
                                    icon: <HomeOutlined />,
                                    label: <Link to="/analytics/house">House</Link>,
                                },
                                {
                                    key: 'hero',
                                    icon: <StarOutlined />,
                                    label: <Link to="/analytics/hero">Hero</Link>,
                                },
                            ],
                        },
                        {
                            key: 'rankings',
                            label: 'RANKINGS',
                            icon: <BarChartOutlined />,
                            children: [
                                {
                                    key: 'ranking-submenu',
                                    label: 'Ranking',
                                    icon: <LineChartOutlined />,
                                    children: [
                                        {
                                            key: 'ranking-stake',
                                            label: <Link to="/analytics/ranking-stake">Stake</Link>,
                                        },
                                        {
                                            key: 'ranking-global-stake',
                                            label: <Link to="/analytics/ranking-global-stake">Global Stake</Link>,
                                        },
                                        {
                                            key: 'ranking-stake-wallet',
                                            label: <Link to="/analytics/ranking-stake-wallet">Stake Wallet</Link>,
                                        },
                                        {
                                            key: 'ranking-global-stake-wallet',
                                            label: <Link to="/analytics/ranking-global-stake-wallet">Global Stake Wallet</Link>,
                                        },
                                        {
                                            key: 'ranking-claim',
                                            label: <Link to="/analytics/ranking-claim">Claim</Link>,
                                        },
                                    ],
                                },
                                {
                                    key: 'ranking-stakers',
                                    icon: <TrophyOutlined />,
                                    label: <Link to="/analytics/ranking-stakers">Top Stakers (Heroes)</Link>,
                                },
                            ],
                        },
                        {
                            key: 'marketplace',
                            label: 'MARKETPLACE',
                            icon: <ShopOutlined />,
                            children: [
                                {
                                    key: 'market',
                                    icon: <ShopOutlined />,
                                    label: <Link to="/analytics/market">Market</Link>,
                                },
                            ],
                        },
                        {
                            key: 'legacy-grp',
                            label: 'SYSTEM',
                            type: 'group',
                            children: [
                                {
                                    key: 'leaderboard',
                                    icon: <TrophyOutlined />,
                                    label: <Link to="/leaderboard">Leaderboard</Link>,
                                },
                            ],
                        },
                    ]}
                />
            </Sider>
            <Layout style={{ marginLeft: 260, background: '#0a0a0a' }}>
                <Content style={{ padding: '0', background: '#0a0a0a' }}>
                     <Routes>
                        <Route path={'/'} element={<Navigate to="/leaderboard" replace />} />
                        <Route path={'/leaderboard'} element={<LeaderBoardPage />} />
                        <Route path={'/analytics'} element={<Navigate to="/analytics/overview" replace />} />
                        <Route path={'/analytics/:view'} element={<AnalyticsPage />} />
                        <Route path="*" element={<Navigate to={'/leaderboard'} replace />} />
                    </Routes>
                </Content>
            </Layout>
        </Layout>
    );
};

export default MainNavigation;

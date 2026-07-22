import React, {useEffect, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {Button, Empty, Input, List, Space, Tooltip, Typography} from 'antd';
import {ArrowRightOutlined, DeleteOutlined, EyeOutlined, StarFilled} from '@ant-design/icons';
import {motion} from 'framer-motion';
import {useStorage} from '../../contexts/LocalStorageContext';
import './WatchPage.css';

const {Title, Text} = Typography;

const FavoritesPage: React.FC = () => {
    const storage = useStorage();
    const navigate = useNavigate();
    const [favorites, setFavorites] = useState<string[]>(() => storage.getFavoriteWallets());
    const [input, setInput] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        document.title = 'Bombcrypto - Watch Favorites';
        return storage.subscribeFavorites(setFavorites);
    }, [storage]);

    const openWallet = (wallet: string) => {
        const w = wallet.trim().toLowerCase();
        if (!w) {
            setError('Wallet must not be empty');
            return;
        }
        if (w.length > 100) {
            setError('Wallet too long');
            return;
        }
        setError(null);
        navigate(`/watch/${encodeURIComponent(w)}`);
    };

    const handleRemove = (wallet: string) => {
        storage.removeFavorite(wallet);
    };

    return (
        <div className="watch-container">
            <motion.div
                initial={{opacity: 0, y: -20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.4}}
                className="watch-page-title-container"
            >
                <Title className="watch-page-title">
                    <EyeOutlined style={{marginRight: 12, color: '#40a9ff'}}/>
                    Watch Wallet
                </Title>
                <Text className="watch-page-subtitle" type="secondary">
                    Open any wallet to watch its current race, stakes, rewards and 7-day earnings.
                </Text>
            </motion.div>

            <div className="watch-add-bar">
                <Space.Compact style={{width: '100%', maxWidth: 560}}>
                    <Input
                        placeholder="Paste a wallet (0x… / username) and press Enter"
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            if (error) setError(null);
                        }}
                        onPressEnter={() => openWallet(input)}
                        maxLength={100}
                        className="watch-add-input"
                    />
                    <Button
                        type="primary"
                        icon={<ArrowRightOutlined/>}
                        onClick={() => openWallet(input)}
                    >
                        Open
                    </Button>
                </Space.Compact>
                {error && (
                    <Text type="secondary" className="watch-add-help">
                        <span className="watch-add-error">{error}</span>
                    </Text>
                )}
            </div>

            <div className="watch-favorites-section">
                <Title level={4} className="watch-favorites-title">
                    <StarFilled style={{color: '#fadb14', marginRight: 8}}/>
                    Favorites
                    <Text type="secondary" style={{marginLeft: 8, fontSize: '0.85rem'}}>
                        ({favorites.length})
                    </Text>
                </Title>

                {favorites.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            <Text type="secondary">
                                No favorites yet. Open any wallet and click ⭐ to bookmark it.
                            </Text>
                        }
                    />
                ) : (
                    <List
                        dataSource={favorites}
                        className="watch-favorites-list"
                        renderItem={(wallet) => (
                            <List.Item
                                className="watch-favorites-item"
                                actions={[
                                    <Tooltip title="Remove favorite" key="remove">
                                        <Button
                                            size="small"
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined/>}
                                            onClick={() => handleRemove(wallet)}
                                        />
                                    </Tooltip>,
                                ]}
                            >
                                <Link
                                    to={`/watch/${encodeURIComponent(wallet)}`}
                                    className="watch-favorites-link"
                                >
                                    <EyeOutlined/>
                                    <span className="watch-favorites-wallet">{wallet}</span>
                                </Link>
                            </List.Item>
                        )}
                    />
                )}
            </div>
        </div>
    );
};

export default FavoritesPage;

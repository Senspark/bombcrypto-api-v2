import React, {useEffect} from 'react';
import {Navigate, useParams} from 'react-router-dom';
import {Typography} from 'antd';
import {motion} from 'framer-motion';
import {EyeOutlined} from '@ant-design/icons';
import WatchCard from './WatchCard';
import './WatchPage.css';

const {Title, Text} = Typography;

const WatchPage: React.FC = () => {
    const {wallet} = useParams<{ wallet: string }>();
    const normalized = (wallet ?? '').trim().toLowerCase();

    useEffect(() => {
        document.title = normalized
            ? `Bombcrypto - Watch ${normalized.slice(0, 6)}…${normalized.slice(-4)}`
            : 'Bombcrypto - Watch Wallet';
    }, [normalized]);

    if (!normalized) {
        return <Navigate to="/watch" replace/>;
    }
    if (normalized.length > 100) {
        return (
            <div className="watch-container">
                <Text type="danger">Invalid wallet.</Text>
            </div>
        );
    }

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
            </motion.div>

            <div className="watch-card-list">
                <WatchCard key={normalized} wallet={normalized}/>
            </div>
        </div>
    );
};

export default WatchPage;

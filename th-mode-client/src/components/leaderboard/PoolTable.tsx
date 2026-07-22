import React from 'react';
import './PoolTable.css';
import {Col, Row, Table, Tag, Tooltip} from 'antd';
import type {ColumnType} from 'antd/es/table';
import {EyeOutlined} from '@ant-design/icons';
import {
    COLOR_STYLES,
    HERO_TYPE_TO_STR,
    HERO_TYPE_TO_STR_DETAIL,
    NETWORK_TO_STR,
    NETWORK_TO_STR_DETAIL,
    RARITY_TO_STR
} from "../../utils/ThModeV2Utils";
import {motion} from 'framer-motion';
import {HeroRarity, IHeroInfo, Network} from "./LeaderBoardData";

const POOL_COLUMNS: ColumnType<IHeroInfo>[] = [
    {
        title: 'Rank',
        key: 'rank',
        className: 'column-rank',
        align: 'center',
        render: (_: any, _record: IHeroInfo, index: number) => {
            const rank = index + 1;
            return (
                <span
                    className="rank-number"
                    data-rank={rank <= 3 ? rank : undefined}
                >
                    {rank}
                </span>
            );
        }
    },
    {
        title: 'User',
        dataIndex: 'userName',
        key: 'userName',
        className: 'column-user',
        render: (userName: string | undefined) => {
            const displayName = (userName || 'Unknown').slice(0, 42);
            const watchable = !!userName && userName.toLowerCase() !== 'unknown';
            if (!watchable) {
                return <span className="user-watch-link user-watch-link--disabled">{displayName}</span>;
            }
            const wallet = userName!.trim().toLowerCase();
            return (
                <Tooltip title="Watch this wallet (opens in new tab)">
                    <a
                        href={`/watch/${encodeURIComponent(wallet)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="user-watch-link"
                    >
                        <EyeOutlined className="user-watch-icon"/>
                        <span>{displayName}</span>
                    </a>
                </Tooltip>
            );
        },
    },
    {
        title: 'Hero Id',
        dataIndex: 'heroId',
        key: 'heroId',
        className: 'column-hero-id',
        align: 'center',
        render: (text: number, record: IHeroInfo) => {
            const heroId = `${NETWORK_TO_STR[record.network]}_${HERO_TYPE_TO_STR[record.heroType]}_${text}`;
            // Determine class based on network
            let networkClass = '';
            if (record.network === Network.BSC) networkClass = 'hero-id-bsc';
            else if (record.network === Network.POLYGON) networkClass = 'hero-id-polygon';
            return (
                <Tooltip
                    title={<span
                        style={{whiteSpace: 'nowrap'}}>{`Network: ${NETWORK_TO_STR_DETAIL[record.network]},  Type: ${HERO_TYPE_TO_STR_DETAIL[record.heroType]},  Hero Id: ${text}`}</span>}
                    overlayStyle={{maxWidth: '500px'}}
                >
                    <span style={{display: 'inline-flex', alignItems: 'center'}}>
                        <span className={`hero-id ${networkClass}`}>{heroId}</span>
                    </span>
                </Tooltip>
            );
        }
    },
    {
        title: 'Bcoin Stake',
        dataIndex: 'stakeBcoinFormatted',
        key: 'stakeBcoinFormatted',
        className: 'column-bcoin',
        align: 'center',
        render: (text: string) => (
            <span className="bcoin-value">{text}</span>
        )
    },
    {
        title: 'Sen Stake',
        dataIndex: 'stakeSenFormatted',
        key: 'stakeSenFormatted',
        className: 'column-sen',
        align: 'center',
        render: (text: string) => (
            <span className="sen-value">{text}</span>
        )
    },
    {
        title: 'Ticket',
        dataIndex: 'ticketCount',
        key: 'ticketCount',
        className: 'column-ticket',
        align: 'center',
        render: (count: number) => (
            <Tag color="blue" className="ticket-tag">
                {count}
            </Tag>
        )
    }
];

interface IEachPoolTableProps {
    data: IHeroInfo[];
    rarity: HeroRarity;
    isVisible: boolean;
    networkFilter: Network | undefined;
    showNetworkRowColor: boolean;
    columns: ColumnType<IHeroInfo>[];
}

const EachPoolTable: React.FC<IEachPoolTableProps> = ({data, rarity, isVisible, networkFilter, showNetworkRowColor, columns}) => {
    if (!isVisible) return null;

    const filteredData = networkFilter !== undefined
        ? data.filter(hero => hero.network === networkFilter)
        : data;

    const visibleHeroCount = filteredData.length;

    return (
        <Col key={rarity} xs={24} md={12}>
            <motion.div
                className="pool-container"
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.5, delay: rarity * 0.1}}
            >
                <div className="pool-header" style={COLOR_STYLES[rarity]}>
                    <h3 className="pool-title">
                        {RARITY_TO_STR[rarity]}
                        <span className="hero-count-badge">{visibleHeroCount} heroes</span>
                    </h3>
                </div>
                <Table
                    dataSource={filteredData}
                    columns={columns}
                    size='small'
                    tableLayout='auto'
                    rowKey={'heroId'}
                    className="custom-table"
                    pagination={{pageSize: 10, size: 'small', showSizeChanger: false}}
                    rowClassName={(record: IHeroInfo) => {
                        if (!showNetworkRowColor) return 'network-neutral';
                        if (record.network === Network.POLYGON) return 'network-polygon';
                        if (record.network === Network.BSC) return 'network-bsc';
                        return 'network-neutral';
                    }}
                />
            </motion.div>
        </Col>
    );
};

const GroupedPoolTable: React.FC<IGroupedPoolData> = (data) => {
    return (
        <Row gutter={[16, 16]} className="pools-section">
            {data.groupedData.map((poolData, idx) => (
                <EachPoolTable
                    key={idx}
                    data={poolData}
                    rarity={idx}
                    isVisible={data.tablesVisible[idx]}
                    networkFilter={data.networkFilter}
                    showNetworkRowColor={data.showNetworkRowColor}
                    columns={POOL_COLUMNS}
                />
            ))}
        </Row>
    );
}

export default GroupedPoolTable;

export interface IGroupedPoolData {
    tablesVisible: boolean[];
    groupedData: Array<IHeroInfo[]>;
    networkFilter: Network | undefined;
    showNetworkRowColor: boolean;
}
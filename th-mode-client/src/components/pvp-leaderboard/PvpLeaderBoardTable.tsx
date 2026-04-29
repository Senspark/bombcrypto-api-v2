import React from 'react';
import { Table, Tag, Typography } from 'antd';
import { IPvpRanking } from './PvpLeaderBoardFetcher';

const { Text } = Typography;

interface Props {
    data: any[];
    type: 'weekly' | 'monthly' | 'hall-winners' | 'hall-bettors';
}

const PvpLeaderBoardTable: React.FC<Props> = ({ data, type }) => {
    const columns: any[] = [
        {
            title: 'Rank',
            key: 'rank',
            render: (_: any, __: any, index: number) => <Text strong># {index + 1}</Text>,
            width: 80,
        },
        {
            title: 'User ID',
            dataIndex: 'user_id',
            key: 'user_id',
            render: (id: number) => <Text code>{id}</Text>,
        },
    ];

    if (type === 'weekly' || type === 'monthly') {
        columns.push(
            {
                title: 'Points',
                dataIndex: 'points',
                key: 'points',
                render: (pts: number) => <Text strong style={{ color: '#1890ff' }}>{pts}</Text>,
            },
            {
                title: 'W/L',
                key: 'wl',
                render: (record: IPvpRanking) => (
                    <span>
                        <Tag color="success">{record.wins}W</Tag>
                        <Tag color="error">{record.losses}L</Tag>
                    </span>
                ),
            },
            {
                title: 'Tier',
                dataIndex: 'tier',
                key: 'tier',
                render: (tier: string) => {
                    const colors: any = {
                        'BRONZE': 'orange',
                        'SILVER': 'blue',
                        'GOLD': 'gold',
                        'PLATINUM': 'cyan',
                        'DIAMOND': 'purple',
                        'MASTER': 'red',
                    };
                    return <Tag color={colors[tier] || 'default'}>{tier}</Tag>;
                },
            }
        );
    }

    if (type === 'hall-winners') {
        columns.push({
            title: 'Total Wins',
            dataIndex: 'total_wins',
            key: 'total_wins',
            render: (val: number) => <Text strong color="success">{val}</Text>,
        });
    }

    if (type === 'hall-bettors') {
        columns.push({
            title: 'Total Wagered',
            dataIndex: 'total_wagered',
            key: 'total_wagered',
            render: (val: number) => <Text strong style={{ color: '#722ed1' }}>{parseFloat(val.toString()).toFixed(2)} BCOIN</Text>,
        });
    }

    return (
        <Table 
            dataSource={data} 
            columns={columns} 
            pagination={{ pageSize: 10 }} 
            size="middle"
            rowKey={(record, index) => `${type}-${record.user_id}-${index}`}
            style={{ marginTop: '16px' }}
        />
    );
};

export default PvpLeaderBoardTable;

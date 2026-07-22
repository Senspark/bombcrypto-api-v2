import React from 'react';
import './RewardPoolPanel.css';
import {Progress, Tooltip} from 'antd';
import {RARITY_TO_STR} from "../../utils/ThModeV2Utils";
import {IRewardPoolInfo} from "./LeaderBoardData";

const BCOIN_COLOR = '#f0b90b';
const SEN_COLOR = '#ed5757';

interface IRewardPoolPanelProps {
    rewardPools?: IRewardPoolInfo[];
}

const percent = (remaining: number, max: number): number => {
    if (!(max > 0)) return 0;
    return Math.max(0, Math.min(100, Math.round((remaining / max) * 100)));
};

const Bar: React.FC<{ label: string; color: string; remaining: number; max: number }> =
    ({label, color, remaining, max}) => {
        const pct = percent(remaining, max);
        return (
            <Tooltip title={`${label}: ${Math.round(remaining)}/${max} (${pct}%)`}>
                <Progress
                    className="reward-pool-progress"
                    percent={pct}
                    strokeColor={color}
                    trailColor="rgba(255, 255, 255, 0.12)"
                    size="small"
                    showInfo={false}
                />
            </Tooltip>
        );
    };

const RewardPoolPanel: React.FC<IRewardPoolPanelProps> = ({rewardPools}) => {
    const byPool = new Map<number, IRewardPoolInfo>();
    (rewardPools || []).forEach(p => byPool.set(p.poolId, p));

    // Largest rarity first (Super Mystic → Common)
    const order = RARITY_TO_STR.map((_, idx) => idx).reverse();

    return (
        <div className="reward-pool-list">
            <div className="reward-pool-legend">
                <span className="reward-pool-legend-item">
                    <span className="reward-pool-swatch" style={{background: BCOIN_COLOR}}/>BCOIN
                </span>
                <span className="reward-pool-legend-item">
                    <span className="reward-pool-swatch" style={{background: SEN_COLOR}}/>SEN
                </span>
            </div>
            {order.map(idx => {
                const pool = byPool.get(idx);
                return (
                    <div className="reward-pool-row" key={idx}>
                        <span className="reward-pool-name">{RARITY_TO_STR[idx]}</span>
                        <div className="reward-pool-bars">
                            {pool ? (
                                <>
                                    <Bar label="BCOIN" color={BCOIN_COLOR}
                                         remaining={pool.bcoinRemaining} max={pool.bcoinMax}/>
                                    <Bar label="SEN" color={SEN_COLOR}
                                         remaining={pool.senRemaining} max={pool.senMax}/>
                                </>
                            ) : (
                                <span className="reward-pool-empty">No data</span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default RewardPoolPanel;

import pg from "pg";
import {NATIVE_REWARD_TYPE} from "../consts/Consts.js";
import ILogger from "../services/ILogger.js";
import {INativeStatsRepository, NativeNetwork, NativeReading, NativeTotals} from "../services/INativeStats.js";

// Read-only. user_native_deposited holds one row per FI user who has ever logged in, most of them all
// zeroes because fn_native_sync inserts the row just to have something to lock — deposited_wei > 0 is
// what narrows it to real depositors. user_block_reward is only ever touched through its primary key.
//
// spent_in_game is deliberately not clamped at 0. If remaining_wei ever overshoots, the negative
// result makes the liability computed from it larger, which understates how much is safe to withdraw.
// Clamping would do the opposite.
const READ_SQL = `
WITH native AS (
    SELECT und.uid = ANY($2::int[]) AS is_excluded,
           und.deposited_wei,
           und.withdrawn_wei,
           und.pending_wei,
           COALESCE(trunc(ubr."values"::numeric * 1e18), 0) AS remaining_wei
    FROM user_native_deposited und
    LEFT JOIN user_block_reward ubr
           ON ubr.uid = und.uid
          AND ubr.type = und.network
          AND ubr.reward_type = $3
    WHERE und.network = $1
      AND und.deposited_wei > 0
)
SELECT
    COUNT(*)                     FILTER (WHERE NOT is_excluded) AS inc_user_count,
    COALESCE(SUM(deposited_wei)  FILTER (WHERE NOT is_excluded), 0) AS inc_deposited_wei,
    COALESCE(SUM(withdrawn_wei)  FILTER (WHERE NOT is_excluded), 0) AS inc_withdrawn_wei,
    COALESCE(SUM(pending_wei)    FILTER (WHERE NOT is_excluded), 0) AS inc_pending_wei,
    COALESCE(SUM(remaining_wei)  FILTER (WHERE NOT is_excluded), 0) AS inc_spendable_wei,
    COALESCE(SUM(deposited_wei - withdrawn_wei - pending_wei - remaining_wei)
                                 FILTER (WHERE NOT is_excluded), 0) AS inc_spent_wei,
    COUNT(*)                     FILTER (WHERE is_excluded) AS exc_user_count,
    COALESCE(SUM(deposited_wei)  FILTER (WHERE is_excluded), 0) AS exc_deposited_wei,
    COALESCE(SUM(withdrawn_wei)  FILTER (WHERE is_excluded), 0) AS exc_withdrawn_wei,
    COALESCE(SUM(pending_wei)    FILTER (WHERE is_excluded), 0) AS exc_pending_wei,
    COALESCE(SUM(remaining_wei)  FILTER (WHERE is_excluded), 0) AS exc_spendable_wei,
    COALESCE(SUM(deposited_wei - withdrawn_wei - pending_wei - remaining_wei)
                                 FILTER (WHERE is_excluded), 0) AS exc_spent_wei
FROM native
`;

export default class NativeStatsRepository implements INativeStatsRepository {
    private log: ILogger;

    constructor(logger: ILogger, private pool: pg.Pool) {
        this.log = logger.clone("[NativeDb]");
    }

    async read(network: NativeNetwork, excludedUids: number[]): Promise<NativeReading> {
        const startedAt = Date.now();
        const {rows} = await this.pool.query(READ_SQL, [network, excludedUids, NATIVE_REWARD_TYPE[network]]);
        const row = rows[0];
        this.log.info(
            `read ${network} excluded=${excludedUids.length} -> users=${row.inc_user_count} took=${Date.now() - startedAt}ms`,
        );
        return {
            included: totalsOf(row, "inc"),
            excluded: totalsOf(row, "exc"),
            excludedUids,
        };
    }
}

// numeric comes back as a string so the wei stay exact; count comes back as a bigint string.
function totalsOf(row: Record<string, string>, prefix: "inc" | "exc"): NativeTotals {
    return {
        userCount: Number(row[`${prefix}_user_count`]),
        depositedWei: row[`${prefix}_deposited_wei`],
        withdrawnWei: row[`${prefix}_withdrawn_wei`],
        pendingWei: row[`${prefix}_pending_wei`],
        spendableWei: row[`${prefix}_spendable_wei`],
        spentInGameWei: row[`${prefix}_spent_wei`],
    };
}

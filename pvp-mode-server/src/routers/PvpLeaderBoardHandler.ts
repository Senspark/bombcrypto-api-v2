import { Request, Response } from "express";
import { IDependencies } from "../Services";
import ILogger from "../services/ILogger";
import IDatabaseService from "../services/IDatabaseService";

export default class PvpLeaderBoardHandler {
    private logger: ILogger;
    private db: IDatabaseService;

    constructor(dependencies: IDependencies) {
        this.logger = dependencies.logger.clone("[Handler]");
        this.db = dependencies.database;
    }

    async getWeeklyLeaderboard(req: Request, res: Response) {
        try {
            const { mode } = req.query;
            let sql = `
                SELECT user_id, week_number, year, points, wins, losses, matches_played, game_mode, tier 
                FROM pvp_weekly_ranking 
                WHERE 1=1
            `;
            const params: any[] = [];
            
            if (mode && mode !== 'ALL') {
                params.push(mode);
                sql += ` AND game_mode = $${params.length}`;
            }

            // Current week/year if not specified
            // For now just return latest entries
            sql += ` ORDER BY year DESC, week_number DESC, points DESC LIMIT 100`;

            const rows = await this.db.query(sql, params);
            res.json({ success: true, data: rows });
        } catch (e: any) {
            this.logger.error("Failed to get weekly leaderboard", e);
            res.status(500).json({ success: false, error: e.message });
        }
    }

    async getMonthlyLeaderboard(req: Request, res: Response) {
        try {
            const { mode } = req.query;
            let sql = `
                SELECT user_id, month, year, points, wins, losses, total_wagered, total_won, game_mode, tier 
                FROM pvp_monthly_ranking 
                WHERE 1=1
            `;
            const params: any[] = [];
            
            if (mode && mode !== 'ALL') {
                params.push(mode);
                sql += ` AND game_mode = $${params.length}`;
            }

            sql += ` ORDER BY year DESC, month DESC, points DESC LIMIT 100`;

            const rows = await this.db.query(sql, params);
            res.json({ success: true, data: rows });
        } catch (e: any) {
            this.logger.error("Failed to get monthly leaderboard", e);
            res.status(500).json({ success: false, error: e.message });
        }
    }

    async getTopBettors(req: Request, res: Response) {
        try {
            const sql = `
                SELECT user_id, SUM(total_wagered) as total_wagered 
                FROM pvp_monthly_ranking 
                GROUP BY user_id 
                ORDER BY total_wagered DESC 
                LIMIT 50
            `;
            const rows = await this.db.query(sql);
            res.json({ success: true, data: rows });
        } catch (e: any) {
            this.logger.error("Failed to get top bettors", e);
            res.status(500).json({ success: false, error: e.message });
        }
    }

    async getTopWinners(req: Request, res: Response) {
        try {
            const sql = `
                SELECT user_id, SUM(wins) as total_wins 
                FROM pvp_weekly_ranking 
                GROUP BY user_id 
                ORDER BY total_wins DESC 
                LIMIT 50
            `;
            const rows = await this.db.query(sql);
            res.json({ success: true, data: rows });
        } catch (e: any) {
            this.logger.error("Failed to get top winners", e);
            res.status(500).json({ success: false, error: e.message });
        }
    }

    async getTopLosers(req: Request, res: Response) {
        try {
            const sql = `
                SELECT user_id, SUM(losses) as total_losses 
                FROM pvp_weekly_ranking 
                GROUP BY user_id 
                ORDER BY total_losses DESC 
                LIMIT 50
            `;
            const rows = await this.db.query(sql);
            res.json({ success: true, data: rows });
        } catch (e: any) {
            this.logger.error("Failed to get top losers", e);
            res.status(500).json({ success: false, error: e.message });
        }
    }

    async getTopPlayers(req: Request, res: Response) {
        try {
            const sql = `
                SELECT user_id, 
                       SUM(wins) as total_wins, 
                       SUM(matches_played) as total_matches,
                       CAST(SUM(wins) AS FLOAT) / NULLIF(SUM(matches_played), 0) as win_rate
                FROM pvp_weekly_ranking 
                GROUP BY user_id 
                HAVING SUM(matches_played) >= 10
                ORDER BY win_rate DESC 
                LIMIT 50
            `;
            const rows = await this.db.query(sql);
            res.json({ success: true, data: rows });
        } catch (e: any) {
            this.logger.error("Failed to get top players", e);
            res.status(500).json({ success: false, error: e.message });
        }
    }
}

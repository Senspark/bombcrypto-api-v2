export interface IPvpRanking {
    user_id: number;
    points: number;
    wins: number;
    losses: number;
    matches_played?: number;
    total_wagered?: number;
    total_won?: number;
    game_mode: string;
    tier: string;
}

export default class PvpLeaderBoardFetcher {
    private static API_BASE = "http://localhost:3006/pvp/leaderboard";

    static async getWeekly(mode: string = "ALL"): Promise<IPvpRanking[]> {
        const res = await fetch(`${this.API_BASE}/weekly?mode=${mode}`);
        const json = await res.json();
        return json.success ? json.data : [];
    }

    static async getMonthly(mode: string = "ALL"): Promise<IPvpRanking[]> {
        const res = await fetch(`${this.API_BASE}/monthly?mode=${mode}`);
        const json = await res.json();
        return json.success ? json.data : [];
    }

    static async getHallOfFame(type: 'bettors' | 'winners' | 'losers' | 'players'): Promise<any[]> {
        const res = await fetch(`${this.API_BASE}/top-${type}`);
        const json = await res.json();
        return json.success ? json.data : [];
    }
}

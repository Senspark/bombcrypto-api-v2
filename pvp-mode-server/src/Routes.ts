import { Express } from "express";
import { IDependencies } from "./Services";
import PvpLeaderBoardHandler from "./routers/PvpLeaderBoardHandler";

export default class Routes {
    private handler: PvpLeaderBoardHandler;

    constructor(dependencies: IDependencies) {
        this.handler = new PvpLeaderBoardHandler(dependencies);
    }

    register(app: Express) {
        app.get("/pvp/leaderboard/weekly", (req, res) => this.handler.getWeeklyLeaderboard(req, res));
        app.get("/pvp/leaderboard/monthly", (req, res) => this.handler.getMonthlyLeaderboard(req, res));
        app.get("/pvp/leaderboard/top-bettors", (req, res) => this.handler.getTopBettors(req, res));
        app.get("/pvp/leaderboard/top-winners", (req, res) => this.handler.getTopWinners(req, res));
        app.get("/pvp/leaderboard/top-losers", (req, res) => this.handler.getTopLosers(req, res));
        app.get("/pvp/leaderboard/top-players", (req, res) => this.handler.getTopPlayers(req, res));

        app.get("/status", (req, res) => {
            res.json({ success: true, status: "ok", service: "pvp-mode-server" });
        });
    }
}

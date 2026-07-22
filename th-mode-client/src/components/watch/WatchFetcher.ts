import {IWatchData} from "./WatchData";
import {sendGetRequest} from "../../utils/NetworkUtils";
import {sleep} from "../../utils/MiscUtils";
import Urls from "../../consts/Urls";

const FETCH_INTERVAL = 5000;
const COUNT_DOWN_INTERVAL = 500;
const IDLE_INTERVAL = 100;

export default class WatchFetcher {
    private _isAlive: boolean = true;
    private _isRunning: boolean = false;
    private _countdownTimer: number = FETCH_INTERVAL;
    private _lastCountdownTime: number = 0;

    constructor(
        private readonly _wallet: string,
        private readonly _onDataFetched: (data: IWatchData) => void,
        private readonly _onTimeCountDown: (timeLeft: number) => void,
    ) {
        this.loop().then();
    }

    start() {
        this._isRunning = true;
    }

    stop() {
        this._isRunning = false;
    }

    destroy() {
        this._isAlive = false;
        this._isRunning = false;
    }

    private async startCountdown() {
        this._countdownTimer = FETCH_INTERVAL;
        this._lastCountdownTime = Date.now();
        await this.updateCountdown();
    }

    private async updateCountdown(): Promise<boolean> {
        while (this._countdownTimer > 0 && this._isRunning && this._isAlive) {
            const now = Date.now();
            const elapsed = now - this._lastCountdownTime;

            if (elapsed >= COUNT_DOWN_INTERVAL) {
                this._countdownTimer -= elapsed;
                this._lastCountdownTime = now;
                if (this._countdownTimer < 0) this._countdownTimer = 0;
                this._onTimeCountDown?.(Math.ceil(this._countdownTimer / 1000));
                await sleep(COUNT_DOWN_INTERVAL);
            } else {
                await sleep(IDLE_INTERVAL);
            }
        }
        return this._countdownTimer <= 0;
    }

    private async loop() {
        await this.startCountdown();

        while (this._isAlive) {
            try {
                if (!this._isRunning) {
                    this._onTimeCountDown?.(Math.ceil(FETCH_INTERVAL / 1000));
                    await sleep(IDLE_INTERVAL);
                    continue;
                }

                const fetched = await sendGetRequest<IWatchData>(Urls.ThWatchWallet(this._wallet), true);

                if (!this._isRunning) continue;

                if (fetched) {
                    this._onDataFetched?.(fetched);
                }

                await this.startCountdown();
            } catch (error) {
                await this.startCountdown();
            }
        }
    }
}

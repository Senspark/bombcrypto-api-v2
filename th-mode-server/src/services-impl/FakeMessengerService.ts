import ILogger from "../services/ILogger";
import IMessengerService from "../services/IMessengerService";
import IEnvConfig from "../services/IEnvConfig";

const FAKE_RACE_ID = 1;
const MIN_STAKE_BY_RARITY = [60, 194, 388, 777, 1942, 3883, 7766, 19415, 38830, 77660];
const ENTRIES_PER_TICK_MIN = 3;
const ENTRIES_PER_TICK_MAX = 8;

type CALL_BACK = (data: any) => void;

export default class FakeMessengerService implements IMessengerService {
    readonly #logger: ILogger;
    readonly #refreshIntervalMs: number;
    readonly #streamListeners = new Map<string, CALL_BACK[]>();
    #heroIdCounter = 1;

    constructor(logger: ILogger, envConfig: IEnvConfig) {
        this.#logger = logger.clone('[MOCK]');
        this.#refreshIntervalMs = envConfig.refreshIntervalMs;
    }

    async send(_streamKey: string, _message: any): Promise<boolean> {
        return true;
    }

    listen(streamKey: string, callback: CALL_BACK): void {
        if (!this.#streamListeners.has(streamKey)) {
            this.#streamListeners.set(streamKey, [callback]);
            this.#startInterval(streamKey);
        } else {
            this.#streamListeners.get(streamKey)!.push(callback);
        }
    }

    #startInterval(streamKey: string) {
        this.#logger.info(`Mock data active — emitting fake entries every ${this.#refreshIntervalMs}ms`);
        setInterval(() => {
            const callbacks = this.#streamListeners.get(streamKey);
            if (!callbacks) return;

            const count = ENTRIES_PER_TICK_MIN + Math.floor(Math.random() * (ENTRIES_PER_TICK_MAX - ENTRIES_PER_TICK_MIN + 1));
            for (let i = 0; i < count; i++) {
                const entry = this.#generateEntry();
                for (const cb of callbacks) {
                    cb(entry);
                }
            }
        }, this.#refreshIntervalMs);
    }

    #generateEntry(): IDataThMode {
        const heroId = this.#heroIdCounter++;
        const uid = Math.floor(heroId / 3) + 1;  // cluster ~3 heroes per uid for watch testing
        const poolIndex = Math.floor(Math.random() * MIN_STAKE_BY_RARITY.length);
        const minStake = MIN_STAKE_BY_RARITY[poolIndex];
        const stakeBcoin = Math.round(minStake * (1 + Math.random() * 1.5));
        return {
            raceId: FAKE_RACE_ID,
            uid,
            userName: `player_${uid}`,
            heroId,
            stakeBcoin,
            stakeSen: 0,
            ticketCount: 1 + Math.floor(Math.random() * 10),
            poolIndex,
            network: Math.floor(Math.random() * 2),
            heroType: Math.floor(Math.random() * 3),
        };
    }
}

interface IDataThMode {
    raceId: number;
    uid: number;
    userName?: string;
    heroId: number;
    stakeBcoin: number;
    stakeSen: number;
    ticketCount: number;
    poolIndex: number;
    network: number;
    heroType: number;
}

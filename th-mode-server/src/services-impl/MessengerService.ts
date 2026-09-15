import ILogger from "../services/ILogger";
import getRedisClient from "./Redis";
import IMessengerService from "../services/IMessengerService";
import IEnvConfig from "../services/IEnvConfig";

type CALL_BACK = (data: any) => void;

/**
 * Redis Pub/Sub subscriber.
 *
 * The shared client from Redis.ts is used only here. Once it subscribes it can't run other commands,
 * so anything else that needs Redis must create its own client. node-redis re-subscribes after a
 * reconnect; messages published while disconnected are lost, which is fine for a live leaderboard.
 */
export default class MessengerService implements IMessengerService {
    readonly #logger: ILogger;
    readonly #redisConnectionString: string;

    constructor(logger: ILogger, envConfig: IEnvConfig) {
        this.#logger = logger.clone('[MSG]');
        this.#redisConnectionString = envConfig.redisConnectionString;
    }

    subscribe(channel: string, callback: CALL_BACK): void {
        getRedisClient(this.#redisConnectionString)
            .subscribe(channel, raw => this.#dispatch(channel, raw, callback))
            .then(() => this.#logger.info(`Subscribed to ${channel}`))
            .catch(e => this.#logger.error(e));
    }

    #dispatch(channel: string, raw: string, callback: CALL_BACK) {
        let payload: any;
        try {
            payload = JSON.parse(raw);
        } catch (e) {
            this.#logger.error(`Undecodable message on ${channel}`);
            return;
        }
        try {
            callback(payload);
        } catch (e) {
            this.#logger.error(e);
        }
    }
}

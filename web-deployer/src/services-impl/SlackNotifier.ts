import INotifier from "../services/INotifier";
import ILogger from "../services/ILogger";

const TIMEOUT_MS = 10 * 1000;

export default class SlackNotifier implements INotifier {
    readonly #logger: ILogger;
    readonly #webhookUrl: string;

    constructor(logger: ILogger, webhookUrl: string) {
        this.#logger = logger.clone('[Slack]');
        this.#webhookUrl = webhookUrl;

        if (!webhookUrl) {
            this.#logger.info('no SLACK_WEBHOOK_URL configured, notifications are disabled');
        }
    }

    async send(text: string): Promise<void> {
        if (!this.#webhookUrl) return;

        try {
            const res = await fetch(this.#webhookUrl, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({text}),
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            if (!res.ok) {
                this.#logger.error(`webhook answered ${res.status}`);
            }
        } catch (e) {
            this.#logger.error(`cannot post: ${(e as Error).message}`);
        }
    }
}

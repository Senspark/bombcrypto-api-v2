import ILogger from "../services/ILogger";
import ISlackNotifier, {SlackShareNotice} from "../services/ISlackNotifier";

// Fire-and-forget: notify() never throws so a Slack failure can't fail /create.
export default class SlackNotifier implements ISlackNotifier {
    readonly #logger: ILogger;
    readonly #webhookUrl: string;

    constructor(logger: ILogger, webhookUrl: string) {
        this.#logger = logger.clone('[SLACK]');
        this.#webhookUrl = webhookUrl;
    }

    notify(notice: SlackShareNotice): void {
        if (!this.#webhookUrl) {
            return;
        }
        const text = [
            `*New Share on X*`,
            `Wallet: \`${notice.wallet}\``,
            `Tweet: ${notice.text}`,
            `Page: ${notice.url}`,
            `Image: ${notice.imageUrl}`,
        ].join('\n');

        fetch(this.#webhookUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                text,
                blocks: [
                    {type: 'section', text: {type: 'mrkdwn', text}},
                    {type: 'image', image_url: notice.imageUrl, alt_text: 'shared image'},
                ],
            }),
        }).catch(e => this.#logger.error(`notify failed: ${e}`));
    }
}

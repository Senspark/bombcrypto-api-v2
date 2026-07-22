export interface SlackShareNotice {
    wallet: string;
    url: string;
    imageUrl: string;
    text: string;
}

export default interface ISlackNotifier {
    // Fire-and-forget: a Slack failure must never fail POST /create.
    notify(notice: SlackShareNotice): void;
}

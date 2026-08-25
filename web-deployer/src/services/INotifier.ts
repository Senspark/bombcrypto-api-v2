export default interface INotifier {
    // Never throws and never rejects: losing a notification must not affect a
    // deploy, and must not take the poller down with it.
    send(text: string): Promise<void>;
}

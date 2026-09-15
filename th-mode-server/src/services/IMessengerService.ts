export default interface IMessengerService {
    subscribe(channel: string, callback: (message: any) => void): void;
}

export default interface ILogger {
    log(message: any): void;
    error(message: any, error?: any): void;
    warn(message: any): void;
    clone(prefix: string): ILogger;
}

export default interface ILogger {
    info(msg: unknown): void;
    warn(msg: unknown): void;
    error(msg: unknown): void;
    clone(prefix: string): ILogger;
}

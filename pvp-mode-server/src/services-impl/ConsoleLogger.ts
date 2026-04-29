import ILogger from "../services/ILogger";

export default class ConsoleLogger implements ILogger {
    constructor(private prefix: string = "") {}

    log(message: any): void {
        console.log(`${this.prefix} ${message}`);
    }

    error(message: any, error?: any): void {
        console.error(`${this.prefix} ${message}`, error || "");
    }

    warn(message: any): void {
        console.warn(`${this.prefix} ${message}`);
    }

    clone(prefix: string): ILogger {
        return new ConsoleLogger(`${this.prefix}${prefix}`);
    }
}

import ILogger from "../../services/ILogger.js";

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

export default class ConsoleLogger implements ILogger {
    constructor(private prefix: string) {}

    info(msg: unknown): void {
        console.info(`${GREEN}${this.tag()} ${this.text(msg)}${RESET}`);
    }

    warn(msg: unknown): void {
        console.warn(`${YELLOW}${this.tag()} ${this.text(msg)}${RESET}`);
    }

    error(msg: unknown): void {
        console.error(`${RED}${this.tag()} ${this.text(msg)}${RESET}`);
    }

    clone(prefix: string): ILogger {
        return new ConsoleLogger(prefix);
    }

    private tag(): string {
        return `${this.prefix} ${new Date().toLocaleTimeString()}`;
    }

    private text(msg: unknown): string {
        if (msg instanceof Error) return msg.stack ?? msg.message;
        if (typeof msg === "string") return msg;
        return JSON.stringify(msg);
    }
}

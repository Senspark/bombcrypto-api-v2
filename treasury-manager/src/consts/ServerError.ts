export class ServerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ServerError";
    }
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

/** `submitted` is true once a transaction has been handed to the node, i.e. gas may already be spent. */
export class SwapError extends Error {
    constructor(message: string, readonly submitted: boolean) {
        super(message);
        this.name = "SwapError";
    }
}

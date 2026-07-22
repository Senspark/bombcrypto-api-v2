export default class ServerError extends Error {
    constructor(message: string, readonly statusCode: number = 400) {
        super(message);
    }
}

export class ValidationError extends ServerError {
    constructor(message: string) {
        super(message, 400);
    }
}

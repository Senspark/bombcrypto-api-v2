import {createHash, randomBytes} from "node:crypto";
import {OAuth2Client} from "google-auth-library";
import IAuthService from "../services/IAuthService";
import IReceiverConfig from "../services/IReceiverConfig";
import ILogger from "../services/ILogger";

export const DEV_OPERATOR = 'dev@localhost';

export class AuthError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = 'AuthError';
    }
}

interface ISession {
    email: string;
    expiresAt: number;
}

// Sessions live in memory because the receiver has no writable volume by
// design - the half of the deployer that holds the secrets has nothing worth
// writing to. A restart costs everyone one re-login, and the receiver only
// restarts when the deployer itself is deployed.
export default class MemoryAuthService implements IAuthService {
    readonly #logger: ILogger;
    readonly #config: IReceiverConfig;
    readonly #google: OAuth2Client | null;
    readonly #sessions = new Map<string, ISession>();

    constructor(logger: ILogger, config: IReceiverConfig) {
        this.#logger = logger.clone('[Auth]');
        this.#config = config;
        this.#google = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;
    }

    enabled(): boolean {
        return this.#google !== null;
    }

    async login(credential: string): Promise<{token: string; email: string}> {
        if (!this.#google) return {token: '', email: DEV_OPERATOR};

        const email = await this.#verify(this.#google, credential);
        const token = randomBytes(32).toString('hex');
        this.#sessions.set(hash(token), {email, expiresAt: Date.now() + this.#config.sessionTtlSeconds * 1000});
        this.#logger.info(`session opened for ${email}`);
        return {token, email};
    }

    async resolve(token: string | undefined): Promise<string | null> {
        if (!this.#google) return DEV_OPERATOR;
        if (!token) return null;

        const key = hash(token);
        const session = this.#sessions.get(key);
        if (!session) return null;
        // Expiry on read: there is no sweeper, and a session nobody comes back
        // for costs one map entry until the next restart.
        if (session.expiresAt <= Date.now()) {
            this.#sessions.delete(key);
            this.#logger.info(`session expired for ${session.email}`);
            return null;
        }
        return session.email;
    }

    async logout(token: string | undefined): Promise<void> {
        if (!token) return;
        this.#sessions.delete(hash(token));
    }

    async #verify(google: OAuth2Client, credential: string): Promise<string> {
        let payload;
        try {
            const ticket = await google.verifyIdToken({idToken: credential, audience: this.#config.googleClientId});
            payload = ticket.getPayload();
        } catch (e) {
            this.#logger.error(`rejected sign-in: ${(e as Error).message}`);
            throw new AuthError('INVALID_CREDENTIAL', 401);
        }

        if (!payload?.email || !payload.email_verified) {
            this.#logger.error('rejected sign-in: unverified or missing email');
            throw new AuthError('INVALID_CREDENTIAL', 401);
        }
        // hd is the Google Workspace domain claim; a personal account never carries it.
        if (payload.hd !== this.#config.allowedEmailDomain) {
            this.#logger.error(`rejected sign-in for ${payload.email}: hd='${payload.hd}'`);
            throw new AuthError('FORBIDDEN_DOMAIN', 403);
        }
        return payload.email;
    }
}

function hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

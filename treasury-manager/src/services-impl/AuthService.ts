import {createHash, randomBytes} from "crypto";
import {OAuth2Client} from "google-auth-library";
import {RedisClientType} from "redis";
import {ClientErrors, RedisKeys} from "../consts/Consts.js";
import IAuthService from "../services/IAuthService.js";
import IEnvConfig from "../services/IEnvConfig.js";
import ILogger from "../services/ILogger.js";

export const DEV_OPERATOR = "dev@localhost";

export class AuthError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = "AuthError";
    }
}

export default class AuthService implements IAuthService {
    private log: ILogger;
    private googleClient: OAuth2Client;

    constructor(logger: ILogger, private env: IEnvConfig, private redis: RedisClientType) {
        this.log = logger.clone("[Auth]");
        this.googleClient = new OAuth2Client(env.googleClientId);
    }

    async login(credential: string): Promise<{token: string; email: string}> {
        if (!this.env.authEnabled) return {token: "", email: DEV_OPERATOR};

        const email = await this.verifyCredential(credential);
        const token = randomBytes(32).toString("hex");
        await this.redis.set(RedisKeys.SESSION_PREFIX + hash(token), email, {EX: this.env.sessionTtlSeconds});
        this.log.info(`session opened for ${email}`);
        return {token, email};
    }

    async resolve(token: string | undefined): Promise<string | null> {
        if (!this.env.authEnabled) return DEV_OPERATOR;
        if (!token) return null;
        return this.redis.get(RedisKeys.SESSION_PREFIX + hash(token));
    }

    async logout(token: string | undefined): Promise<void> {
        if (!this.env.authEnabled || !token) return;
        await this.redis.del(RedisKeys.SESSION_PREFIX + hash(token));
    }

    private async verifyCredential(credential: string): Promise<string> {
        let payload;
        try {
            const ticket = await this.googleClient.verifyIdToken({
                idToken: credential,
                audience: this.env.googleClientId,
            });
            payload = ticket.getPayload();
        } catch (e) {
            this.log.error(e);
            throw new AuthError(ClientErrors.INVALID_CREDENTIAL, 401);
        }

        if (!payload || !payload.email || !payload.email_verified) {
            this.log.warn(`rejected sign-in: unverified or missing email`);
            throw new AuthError(ClientErrors.INVALID_CREDENTIAL, 401);
        }
        // hd is the Google Workspace domain claim; a personal gmail account never carries it.
        if (payload.hd !== this.env.allowedEmailDomain) {
            this.log.warn(`rejected sign-in for ${payload.email}: hd='${payload.hd}'`);
            throw new AuthError(ClientErrors.FORBIDDEN_DOMAIN, 403);
        }
        return payload.email;
    }
}

function hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

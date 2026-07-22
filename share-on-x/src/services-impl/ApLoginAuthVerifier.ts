import ILogger from "../services/ILogger";
import IAuthVerifier, {AuthResult} from "../services/IAuthVerifier";

interface VerifyEnvelope {
    success?: boolean;
    message?: { valid?: boolean; wallet?: string };
}

const VERIFY_PATH = '/web/verify_login';

export default class ApLoginAuthVerifier implements IAuthVerifier {
    readonly #logger: ILogger;
    readonly #verifyUrl: string;

    constructor(logger: ILogger, baseUrl: string) {
        this.#logger = logger.clone('[AUTH]');
        this.#verifyUrl = `${baseUrl.replace(/\/+$/, '')}${VERIFY_PATH}`;
    }

    async verify(authHeader: string | undefined): Promise<AuthResult | null> {
        if (!authHeader) {
            return null;
        }
        try {
            const res = await fetch(this.#verifyUrl, {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'authorization': authHeader,
                },
            });
            if (!res.ok) {
                this.#logger.info(`ap-login rejected token: ${res.status}`);
                return null;
            }
            const body = await res.json() as VerifyEnvelope;
            const wallet = body?.message?.wallet;
            if (!body?.success || !body?.message?.valid || !wallet) {
                return null;
            }
            return {wallet: wallet.toLowerCase()};
        } catch (e) {
            this.#logger.error(`verify failed: ${e}`);
            return null;
        }
    }
}

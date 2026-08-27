import {NextFunction, Request, Response} from "express";
import IAuthService from "../services/IAuthService";
import ILogger from "../services/ILogger";
import {AuthError} from "../services-impl/MemoryAuthService";
import {SESSION_COOKIE} from "../consts/Consts";

export default class AuthHandler {
    readonly #logger: ILogger;
    readonly #auth: IAuthService;
    readonly #secureCookie: boolean;

    constructor(logger: ILogger, auth: IAuthService, secureCookie: boolean) {
        this.#logger = logger.clone('[Auth]');
        this.#auth = auth;
        this.#secureCookie = secureCookie;
    }

    // Guards only the two endpoints that write a production web root. The
    // dashboard and its build history stay public.
    require = (req: Request, res: Response, next: NextFunction): void => {
        this.#auth.resolve(req.cookies?.[SESSION_COOKIE])
            .then(email => {
                if (!email) {
                    res.sendErr('UNAUTHORIZED', 401);
                    return;
                }
                res.locals.actor = email;
                next();
            })
            .catch(e => {
                this.#logger.error(`resolving session failed: ${(e as Error).message}`);
                res.sendErr('INTERNAL', 500);
            });
    };

    login = (req: Request, res: Response): void => {
        const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
        if (!credential) {
            res.sendErr('INVALID_CREDENTIAL', 400);
            return;
        }

        this.#auth.login(credential)
            .then(({token, email}) => {
                if (token) {
                    res.cookie(SESSION_COOKIE, token, {
                        httpOnly: true,
                        secure: this.#secureCookie,
                        sameSite: 'lax',
                        path: '/',
                    });
                }
                res.sendOk({email});
            })
            .catch(e => {
                if (e instanceof AuthError) {
                    res.sendErr(e.message, e.status);
                    return;
                }
                this.#logger.error(`sign-in failed: ${(e as Error).message}`);
                res.sendErr('INTERNAL', 500);
            });
    };

    logout = (req: Request, res: Response): void => {
        this.#auth.logout(req.cookies?.[SESSION_COOKIE])
            .catch(e => this.#logger.error(`logout failed: ${(e as Error).message}`))
            .finally(() => {
                res.clearCookie(SESSION_COOKIE, {path: '/'});
                res.sendOk({ok: true});
            });
    };

    me = (req: Request, res: Response): void => {
        this.#auth.resolve(req.cookies?.[SESSION_COOKIE])
            .then(email => {
                if (!email) {
                    res.sendErr('UNAUTHORIZED', 401);
                    return;
                }
                res.sendOk({email});
            })
            .catch(e => {
                this.#logger.error(`resolving session failed: ${(e as Error).message}`);
                res.sendErr('INTERNAL', 500);
            });
    };
}

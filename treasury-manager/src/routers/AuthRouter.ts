import {NextFunction, Request, Response, Router} from "express";
import {ClientErrors} from "../consts/Consts.js";
import IAuthService from "../services/IAuthService.js";
import ILogger from "../services/ILogger.js";
import {AuthError} from "../services-impl/AuthService.js";

export const SESSION_COOKIE = "tm_session";

export function buildAuthMiddleware(logger: ILogger, auth: IAuthService, isProduction: boolean) {
    const log = logger.clone("[AuthMw]");
    return (req: Request, res: Response, next: NextFunction): void => {
        auth.resolve(req.cookies?.[SESSION_COOKIE])
            .then((email) => {
                if (!email) {
                    res.status(401).json({error: ClientErrors.UNAUTHORIZED});
                    return;
                }
                res.locals.operator = email;
                next();
            })
            .catch((e) => {
                log.error(e);
                res.status(500).json({error: ClientErrors.INTERNAL});
            });
    };
}

export function buildAuthRouter(logger: ILogger, auth: IAuthService, isProduction: boolean): Router {
    const log = logger.clone("[AuthApi]");
    const router = Router();

    router.post("/google", (req, res) => {
        const credential = typeof req.body?.credential === "string" ? req.body.credential : "";
        if (!credential) {
            res.status(400).json({error: ClientErrors.INVALID_CREDENTIAL});
            return;
        }
        auth.login(credential)
            .then(({token, email}) => {
                if (token) {
                    res.cookie(SESSION_COOKIE, token, {
                        httpOnly: true,
                        secure: isProduction,
                        sameSite: "lax",
                        path: "/",
                    });
                }
                res.json({email});
            })
            .catch((e) => {
                if (e instanceof AuthError) {
                    res.status(e.status).json({error: e.message});
                    return;
                }
                log.error(e);
                res.status(500).json({error: ClientErrors.INTERNAL});
            });
    });

    router.post("/logout", (req, res) => {
        auth.logout(req.cookies?.[SESSION_COOKIE])
            .catch((e) => log.error(e))
            .finally(() => {
                res.clearCookie(SESSION_COOKIE, {path: "/"});
                res.json({ok: true});
            });
    });

    router.get("/me", (req, res) => {
        auth.resolve(req.cookies?.[SESSION_COOKIE])
            .then((email) => {
                if (!email) {
                    res.status(401).json({error: ClientErrors.UNAUTHORIZED});
                    return;
                }
                res.json({email});
            })
            .catch((e) => {
                log.error(e);
                res.status(500).json({error: ClientErrors.INTERNAL});
            });
    });

    return router;
}

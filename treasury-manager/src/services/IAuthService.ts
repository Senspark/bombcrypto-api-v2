export default interface IAuthService {
    /** Verifies a Google Identity Services ID token and opens a session. Returns the raw cookie token. */
    login(credential: string): Promise<{token: string; email: string}>;
    /** Resolves a cookie token to an operator email, or null. Returns a synthetic operator when auth is off. */
    resolve(token: string | undefined): Promise<string | null>;
    logout(token: string | undefined): Promise<void>;
}

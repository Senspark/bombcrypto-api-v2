export interface AuthResult {
    wallet: string;
}

export default interface IAuthVerifier {
    // Returns the resolved wallet, or null when the token is missing/invalid.
    verify(authHeader: string | undefined): Promise<AuthResult | null>;
}

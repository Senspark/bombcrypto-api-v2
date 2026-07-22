export default interface IRateLimiter {
    // Records one share for `wallet` today; returns false once the daily cap is hit.
    hit(wallet: string): Promise<boolean>;
}

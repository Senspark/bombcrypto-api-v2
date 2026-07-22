/**
 * Recover the bare identity (wallet / account) from a possibly network-suffixed username.
 *
 * The game server keeps a network suffix on its in-memory username while the shared `public.user`
 * table stores the bare identity. The current format uses a `#` separator
 * (`<wallet>#bsc` / `<wallet>#polygon` / `<wallet>#tr`); older EVM logins may carry a no-separator
 * suffix appended directly to the 42-char address. Mirrors the game server's
 * `UserNameSuffix.removeSuffixName`.
 */
export function removeNameSuffix(userName: string): string {
    const hashIdx = userName.indexOf('#');
    if (hashIdx >= 0) {
        return userName.slice(0, hashIdx);
    }
    // EVM wallet is always 42 chars (0x + 40 hex); strip any legacy no-separator suffix.
    if (userName.startsWith('0x') && userName.length > 42) {
        return userName.slice(0, 42);
    }
    return userName;
}

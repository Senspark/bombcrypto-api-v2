export type HookIpMode = 'off' | 'log' | 'enforce';

export default interface IHookIpFilter {
    // Rejects only in 'enforce' mode, and only when a list has actually loaded.
    // A filter that cannot answer must not be the thing that stops deploys.
    allow(ip: string | undefined): boolean;
}

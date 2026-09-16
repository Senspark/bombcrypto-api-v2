import ISecretStore from "../services/ISecretStore";

function envVarFor(siteName: string): string {
    return `WEBHOOK_SECRET_${siteName.toUpperCase().replace(/-/g, '_')}`;
}

export default class EnvSecretStore implements ISecretStore {
    readonly #secrets = new Map<string, string>();

    // Every site is resolved up front: a missing secret must stop the process,
    // not surface as a 500 the first time that site is pushed.
    constructor(siteNames: string[]) {
        for (const name of siteNames) {
            const variable = envVarFor(name);
            const secret = process.env[variable];
            if (!secret) {
                throw new Error(`site "${name}" is missing env ${variable}`);
            }
            this.#secrets.set(name, secret);
        }
    }

    get(siteName: string): string {
        const secret = this.#secrets.get(siteName);
        if (!secret) {
            throw new Error(`no webhook secret loaded for site "${siteName}"`);
        }
        return secret;
    }
}

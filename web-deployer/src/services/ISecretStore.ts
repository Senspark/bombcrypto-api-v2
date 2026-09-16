// Webhook secrets live only in the receiver, so they are loaded separately from
// the site config that both processes share.
export default interface ISecretStore {
    get(siteName: string): string;
}

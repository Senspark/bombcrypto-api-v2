export interface ShareRecord {
    source: string;
    title: string;
    description: string;
    text: string;
    wallet: string;
    createdAt: number;
}

export default interface IShareStore {
    save(id: string, record: ShareRecord): Promise<void>;

    get(id: string): Promise<ShareRecord | null>;

    delete(id: string): Promise<void>;
}

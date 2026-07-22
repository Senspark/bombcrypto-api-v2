export default interface IImageStore {
    save(id: string, jpeg: Buffer): Promise<void>;

    delete(id: string): Promise<void>;
}

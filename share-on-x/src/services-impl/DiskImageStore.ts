import {mkdir, unlink, writeFile} from "node:fs/promises";
import {join} from "node:path";
import ILogger from "../services/ILogger";
import IImageStore from "../services/IImageStore";

// Writes {id}.jpg into the image volume; nginx serves it statically.
export default class DiskImageStore implements IImageStore {
    readonly #logger: ILogger;
    readonly #imageDir: string;
    #ensured = false;

    constructor(logger: ILogger, imageDir: string) {
        this.#logger = logger.clone('[IMAGE-STORE]');
        this.#imageDir = imageDir;
    }

    async save(id: string, jpeg: Buffer): Promise<void> {
        await this.ensureDir();
        await writeFile(this.pathFor(id), jpeg);
    }

    async delete(id: string): Promise<void> {
        try {
            await unlink(this.pathFor(id));
        } catch (e: any) {
            if (e?.code !== 'ENOENT') {
                this.#logger.error(`Failed to delete image ${id}: ${e}`);
            }
        }
    }

    private pathFor(id: string): string {
        return join(this.#imageDir, `${id}.jpg`);
    }

    private async ensureDir(): Promise<void> {
        if (this.#ensured) {
            return;
        }
        await mkdir(this.#imageDir, {recursive: true});
        this.#ensured = true;
    }
}

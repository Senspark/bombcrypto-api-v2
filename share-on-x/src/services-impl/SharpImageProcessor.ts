import sharp from "sharp";
import ILogger from "../services/ILogger";
import IImageProcessor from "../services/IImageProcessor";
import {ValidationError} from "../consts/ServerError";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const MAX_INPUT_PIXELS = 40_000_000; // decompression-bomb guard

export default class SharpImageProcessor implements IImageProcessor {
    readonly #logger: ILogger;
    readonly #maxBytes: number;

    constructor(logger: ILogger, maxBytes: number) {
        this.#logger = logger.clone('[IMG]');
        this.#maxBytes = maxBytes;
    }

    async process(base64: string): Promise<Buffer> {
        if (!base64) {
            throw new ValidationError('Missing image');
        }

        let buffer: Buffer;
        try {
            buffer = Buffer.from(base64, 'base64');
        } catch {
            throw new ValidationError('Invalid base64');
        }

        if (buffer.length === 0) {
            throw new ValidationError('Empty image');
        }
        if (buffer.length > this.#maxBytes) {
            throw new ValidationError('Image too large');
        }
        if (!this.isJpeg(buffer)) {
            throw new ValidationError('Not a JPEG');
        }

        try {
            // Re-encode (no metadata carried over) -> strips EXIF/ICC/polyglot.
            return await sharp(buffer, {
                failOn: 'error',
                limitInputPixels: MAX_INPUT_PIXELS,
            })
                .resize(OG_WIDTH, OG_HEIGHT, {fit: 'cover', position: 'centre'})
                .jpeg({quality: 82})
                .toBuffer();
        } catch (e) {
            this.#logger.error(`re-encode failed: ${e}`);
            throw new ValidationError('Unprocessable image');
        }
    }

    private isJpeg(buffer: Buffer): boolean {
        return buffer.length >= 3
            && buffer[0] === 0xFF
            && buffer[1] === 0xD8
            && buffer[2] === 0xFF;
    }
}

export default interface IImageProcessor {
    // Decode/validate base64 JPEG, re-encode a normalized 1200x630 JPEG (strips
    // metadata/polyglot). Throws ValidationError on bad input.
    process(base64: string): Promise<Buffer>;
}

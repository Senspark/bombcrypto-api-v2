import {createHmac, timingSafeEqual} from "node:crypto";

const PREFIX = 'sha256=';

export function verifyGithubSignature(secret: string, rawBody: Buffer, header: string | undefined): boolean {
    if (!header || !header.startsWith(PREFIX)) return false;

    const expected = Buffer.from(PREFIX + createHmac('sha256', secret).update(rawBody).digest('hex'));
    const actual = Buffer.from(header);
    if (expected.length !== actual.length) return false;

    return timingSafeEqual(expected, actual);
}

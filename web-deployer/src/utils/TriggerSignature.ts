import {createPrivateKey, createPublicKey, KeyObject, sign, verify} from "node:crypto";

// The builder runs site code, so anything it holds is readable by that code. A
// shared secret there would be forgeable by the very builds it is meant to gate,
// so triggers are signed instead: only the receiver holds the private half.
export function loadPrivateKey(base64Pkcs8Der: string): KeyObject {
    return createPrivateKey({key: Buffer.from(base64Pkcs8Der, 'base64'), format: 'der', type: 'pkcs8'});
}

export function loadPublicKey(base64SpkiDer: string): KeyObject {
    return createPublicKey({key: Buffer.from(base64SpkiDer, 'base64'), format: 'der', type: 'spki'});
}

export function signTrigger(key: KeyObject, body: Buffer): string {
    return sign(null, body, key).toString('base64');
}

export function verifyTrigger(key: KeyObject, body: Buffer, signature: string | undefined): boolean {
    if (!signature) return false;
    try {
        return verify(null, body, key, Buffer.from(signature, 'base64'));
    } catch {
        return false;
    }
}

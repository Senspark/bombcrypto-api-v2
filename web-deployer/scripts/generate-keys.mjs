// Generates the Ed25519 pair the receiver uses to sign build triggers.
// The private half belongs to the receiver only; the builder gets the public
// half, which is safe for the site code it runs to read.
import {generateKeyPairSync} from 'node:crypto';

const {publicKey, privateKey} = generateKeyPairSync('ed25519');

console.log(`TRIGGER_PRIVATE_KEY=${privateKey.export({type: 'pkcs8', format: 'der'}).toString('base64')}`);
console.log(`TRIGGER_PUBLIC_KEY=${publicKey.export({type: 'spki', format: 'der'}).toString('base64')}`);

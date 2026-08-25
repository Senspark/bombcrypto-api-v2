export type DeployStatus = 'IDLE' | 'BUILDING' | 'SUCCESS' | 'FAILED';

export const SHA_REGEX = /^[0-9a-f]{40}$/;
export const SITE_NAME_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const TRIGGER_SIGNATURE_HEADER = 'x-deploy-signature';

export const MAX_AUTHOR_LENGTH = 64;
export const MAX_COMMIT_MESSAGE_LENGTH = 160;

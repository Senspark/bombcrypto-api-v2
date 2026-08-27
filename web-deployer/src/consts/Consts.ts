export type DeployStatus = 'IDLE' | 'BUILDING' | 'SUCCESS' | 'FAILED';

// A build of the deploy branch goes straight to production - merging is the
// gate. A pr build goes to preview and can never reach production, because
// nothing copies preview into a production web root.
export type DeployKind = 'build' | 'pr' | 'rollback';

export const SHA_REGEX = /^[0-9a-f]{40}$/;
export const SITE_NAME_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const TRIGGER_SIGNATURE_HEADER = 'x-deploy-signature';
export const SESSION_COOKIE = 'wd_session';

// Comment body that asks for a preview build, and who may write it. CONTRIBUTOR
// is deliberately absent: it only means the author has had a pull request merged
// before, which is not a role.
export const PREVIEW_COMMAND = '/preview';
export const PREVIEW_ROLES = ['OWNER', 'MEMBER', 'COLLABORATOR'];

export const MAX_AUTHOR_LENGTH = 64;
export const MAX_COMMIT_MESSAGE_LENGTH = 160;
export const MAX_ACTOR_LENGTH = 128;

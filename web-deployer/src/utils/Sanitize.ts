const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

// Author names and commit messages are attacker-controlled: they arrive in the
// webhook payload and end up in the dashboard, in Slack and in log lines. Cut
// them down to plain single-line text where they enter the system, rather than
// trusting every consumer downstream to escape them correctly.
export function sanitizeText(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== 'string') return undefined;

    // Only the subject line: a commit body would fill the dashboard row and the
    // Slack line with text nobody reads at a glance.
    const flat = value.split('\n')[0].replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
    if (!flat) return undefined;

    return flat.length > maxLength ? `${flat.slice(0, maxLength - 1)}...` : flat;
}

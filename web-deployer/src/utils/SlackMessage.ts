import {IDeployState} from "../services/IDeployStateStore";
import {IBuildSiteState} from "../services/IBuildSnapshot";

const GITHUB_PREFIX = 'https://github.com/';

// Author names and commit messages come from the push payload. Slack only needs
// these three characters escaped for text to stay text.
function esc(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Slack link syntax is <url|label>, so a label carrying | or > would break out
// of it. Everything used as a label here is a hostname or a hex sha, but the
// strip keeps that true if a site url is ever edited by hand into something else.
function link(url: string, label: string): string {
    return `<${url}|${esc(label).replace(/[|<>]/g, '')}>`;
}

function hostLabel(url: string | undefined, fallback: string): string {
    if (!url) return `*${esc(fallback)}*`;

    // The host is the name people know the site by; the site name is an internal
    // handle that means nothing in a channel.
    let host: string;
    try {
        host = new URL(url).host;
    } catch {
        return `*${esc(fallback)}*`;
    }
    return `*${link(url, host)}*`;
}

function siteLabel(site: IBuildSiteState): string {
    return hostLabel(site.url, site.name);
}

function previewLabel(site: IBuildSiteState): string {
    return hostLabel(site.previewUrl, site.name);
}

function commitLabel(site: IBuildSiteState, state: IDeployState): string {
    const short = state.commit.slice(0, 7);
    if (!site.repo.startsWith(GITHUB_PREFIX)) return `\`${short}\``;

    const base = site.repo.replace(/\.git$/, '');
    return link(`${base}/commit/${state.commit}`, short);
}

function took(ms?: number): string {
    return ms == null ? '' : ` in ${(ms / 1000).toFixed(1)}s`;
}

function details(site: IBuildSiteState, state: IDeployState): string {
    if (!state.commit) return '';
    const who = state.author ? ` by ${esc(state.author)}` : '';
    const message = state.commitMessage ? `\n> ${esc(state.commitMessage)}` : '';
    return `${commitLabel(site, state)}${who}${message}`;
}

function prLabel(site: IBuildSiteState, state: IDeployState): string {
    const label = `PR #${state.prNumber}`;
    if (!site.repo.startsWith(GITHUB_PREFIX)) return `*${label}*`;

    const base = site.repo.replace(/\.git$/, '');
    return `*${link(`${base}/pull/${state.prNumber}`, label)}*`;
}

function by(state: IDeployState): string {
    return state.actor ? ` by ${esc(state.actor)}` : '';
}

// Slack only. It can name a directory the build wrote, which is the same reason
// error text never reaches the dashboard.
function warned(state: IDeployState): string {
    return state.warning ? `\n:warning: ${esc(state.warning)}` : '';
}

// Only finished operations are announced. A "building" message doubles the
// traffic in the channel to say something the next message says anyway.
export function buildMessage(site: IBuildSiteState, state: IDeployState, dashboardUrl: string): string | null {
    if (state.status !== 'SUCCESS' && state.status !== 'FAILED') return null;
    const footer = dashboardUrl ? `\nXem lịch sử deploy: ${dashboardUrl}` : '';
    const ok = state.status === 'SUCCESS';

    switch (state.kind) {
        case 'pr':
            return ok
                ? `:eyes: ${prLabel(site, state)} on ${previewLabel(site)}${took(state.durationMs)}`
                    + `\n${details(site, state)}${by(state)}`
                : `:x: ${prLabel(site, state)} build FAILED${took(state.durationMs)}${by(state)}`
                    + (state.error ? `\n\`\`\`${esc(state.error)}\`\`\`` : '')
                    + footer;
        case 'rollback':
            return ok
                ? `:rewind: ${siteLabel(site)} rolled back to ${commitLabel(site, state)}${by(state)}${footer}`
                : `:x: rollback of ${siteLabel(site)} to ${commitLabel(site, state)} FAILED${by(state)}`
                    + (state.error ? `\n\`\`\`${esc(state.error)}\`\`\`` : '')
                    + footer;
        default:
            // Merging is the gate: a build of the deploy branch is already live
            // by the time this is sent.
            return ok
                ? `:rocket: ${siteLabel(site)} is live${took(state.durationMs)}`
                    + `\n${details(site, state)}${warned(state)}${footer}`
                // The error tail is build output, which is why it goes here and
                // not to the dashboard: this channel is private, that page is not.
                : `:x: ${siteLabel(site)} build FAILED${took(state.durationMs)} - the live site is unchanged`
                    + `\n${details(site, state)}`
                    + (state.error ? `\n\`\`\`${esc(state.error)}\`\`\`` : '')
                    + footer;
    }
}

export function builderLostMessage(reason: string): string {
    return `:warning: deployer cannot reach the builder: ${esc(reason)}`
        + `\nBuilds may be running without being reported here.`;
}

export function builderBackMessage(): string {
    return `:arrows_counterclockwise: deployer reconnected to the builder.`;
}

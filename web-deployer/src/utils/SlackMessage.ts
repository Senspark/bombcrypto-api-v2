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

function siteLabel(site: IBuildSiteState): string {
    if (!site.url) return `*${esc(site.name)}*`;

    // The host is the name people know the site by; the site name is an internal
    // handle that means nothing in a channel.
    let host: string;
    try {
        host = new URL(site.url).host;
    } catch {
        return `*${esc(site.name)}*`;
    }
    return `*${link(site.url, host)}*`;
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
    const who = state.author ? ` by ${esc(state.author)}` : '';
    const message = state.commitMessage ? `\n> ${esc(state.commitMessage)}` : '';
    return `${commitLabel(site, state)}${who}${message}`;
}

// Only finished builds are announced. A "building" message doubles the traffic
// in the channel to say something the next message says anyway.
export function buildMessage(site: IBuildSiteState, state: IDeployState, dashboardUrl: string): string | null {
    const footer = dashboardUrl ? `\nXem lịch sử build: ${dashboardUrl}` : '';

    switch (state.status) {
        case 'SUCCESS':
            return `:white_check_mark: ${siteLabel(site)} deployed${took(state.durationMs)}`
                + `\n${details(site, state)}${footer}`;
        case 'FAILED':
            // The error tail is build output, which is why it goes here and not
            // to the dashboard: this channel is private, that page is not.
            return `:x: ${siteLabel(site)} build FAILED${took(state.durationMs)}\n${details(site, state)}`
                + (state.error ? `\n\`\`\`${esc(state.error)}\`\`\`` : '')
                + footer;
        default:
            return null;
    }
}

export function builderLostMessage(reason: string): string {
    return `:warning: deployer cannot reach the builder: ${esc(reason)}`
        + `\nBuilds may be running without being reported here.`;
}

export function builderBackMessage(): string {
    return `:arrows_counterclockwise: deployer reconnected to the builder.`;
}

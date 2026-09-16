import {readFileSync} from "node:fs";
import ISiteRegistry, {IPublicSite, ISite} from "../services/ISiteRegistry";
import ILogger from "../services/ILogger";
import {SITE_NAME_REGEX} from "../consts/Consts";

interface ISiteFileEntry {
    name?: unknown;
    repo?: unknown;
    branch?: unknown;
    previewDir?: unknown;
    publishDir?: unknown;
    installCmd?: unknown;
    buildCmd?: unknown;
    outputDir?: unknown;
    url?: unknown;
    previewUrl?: unknown;
}

const DEFAULT_INSTALL_CMD = 'npm ci';
const DEFAULT_BUILD_CMD = 'npm run build';
const DEFAULT_OUTPUT_DIR = 'dist';

export default class SiteRegistry implements ISiteRegistry {
    readonly #sites = new Map<string, ISite>();

    constructor(sitesFile: string, logger: ILogger) {
        const log = logger.clone('[Sites]');

        let parsed: unknown;
        try {
            parsed = JSON.parse(readFileSync(sitesFile, 'utf8'));
        } catch (e) {
            throw new Error(`cannot read sites file ${sitesFile}: ${(e as Error).message}`);
        }
        if (!Array.isArray(parsed)) {
            throw new Error(`sites file ${sitesFile} must contain a JSON array`);
        }

        for (const raw of parsed as ISiteFileEntry[]) {
            const site = this.#parseEntry(raw);
            if (this.#sites.has(site.name)) {
                throw new Error(`duplicate site "${site.name}" in ${sitesFile}`);
            }
            this.#sites.set(site.name, site);
            log.info(`loaded site=${site.name} repo=${site.repo} branch=${site.branch} previewDir=${site.previewDir} publishDir=${site.publishDir} build="${site.buildCmd.join(' ')}" out=${site.outputDir}`);
        }

        if (this.#sites.size === 0) {
            log.info(`no sites configured in ${sitesFile}`);
        }
    }

    list(): ISite[] {
        return [...this.#sites.values()];
    }

    get(name: string): ISite | undefined {
        return this.#sites.get(name);
    }

    toPublic(site: ISite): IPublicSite {
        return {name: site.name, repo: site.repo, branch: site.branch, url: site.url, previewUrl: site.previewUrl};
    }

    #parseEntry(raw: ISiteFileEntry): ISite {
        const name = this.#requireString(raw.name, 'name');
        if (!SITE_NAME_REGEX.test(name)) {
            throw new Error(`site name "${name}" must be lowercase alphanumeric with dashes`);
        }

        const repo = this.#requireString(raw.repo, `${name}.repo`);
        if (!repo.startsWith('https://')) {
            throw new Error(`site "${name}" repo must be an https url (no ssh keys on this host)`);
        }

        const url = this.#requireHttps(raw.url, `${name}.url`);
        const previewUrl = this.#requireHttps(raw.previewUrl, `${name}.previewUrl`);

        const previewDir = this.#requireString(raw.previewDir, `${name}.previewDir`);
        const publishDir = this.#requireString(raw.publishDir, `${name}.publishDir`);
        // A typo making them the same directory would publish straight to
        // production and into preview at once, so a pull request build and the
        // live site would overwrite each other.
        if (previewDir === publishDir) {
            throw new Error(`site "${name}" previewDir and publishDir must be different directories`);
        }

        const outputDir = this.#optionalString(raw.outputDir, `${name}.outputDir`) ?? DEFAULT_OUTPUT_DIR;
        if (outputDir.startsWith('/') || outputDir.split('/').includes('..')) {
            throw new Error(`site "${name}" outputDir must be a path inside the repo`);
        }

        return {
            name,
            repo,
            branch: this.#requireString(raw.branch, `${name}.branch`),
            previewDir,
            publishDir,
            installCmd: this.#parseCommand(raw.installCmd, `${name}.installCmd`, DEFAULT_INSTALL_CMD),
            buildCmd: this.#parseCommand(raw.buildCmd, `${name}.buildCmd`, DEFAULT_BUILD_CMD),
            outputDir,
            url,
            previewUrl,
        };
    }

    #requireHttps(value: unknown, field: string): string | undefined {
        const parsed = this.#optionalString(value, field);
        if (parsed !== undefined && !parsed.startsWith('https://')) {
            throw new Error(`site field "${field}" must be an https url`);
        }
        return parsed;
    }

    // Commands run without a shell, so they are a plain argv split - no pipes,
    // no `&&`, nothing the site repo could smuggle in through a config value.
    #parseCommand(value: unknown, field: string, fallback: string): string[] {
        const raw = this.#optionalString(value, field) ?? fallback;
        const parts = raw.split(/\s+/).filter(Boolean);
        if (parts.length === 0) {
            throw new Error(`site field "${field}" must name a command`);
        }
        return parts;
    }

    #optionalString(value: unknown, field: string): string | undefined {
        if (value === undefined || value === null) return undefined;
        if (typeof value !== 'string' || value.trim() === '') {
            throw new Error(`site field "${field}" must be a non-empty string when present`);
        }
        return value.trim();
    }

    #requireString(value: unknown, field: string): string {
        if (typeof value !== 'string' || value.trim() === '') {
            throw new Error(`site field "${field}" must be a non-empty string`);
        }
        return value.trim();
    }
}

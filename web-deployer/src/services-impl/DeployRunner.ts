import {spawn} from "node:child_process";
import {accessSync, constants, copyFileSync, createWriteStream, existsSync, mkdirSync, renameSync, rmSync, WriteStream} from "node:fs";
import {join} from "node:path";
import IDeployRunner, {IDeployMeta} from "../services/IDeployRunner";
import IDeployStateStore, {IDeployState} from "../services/IDeployStateStore";
import ISiteRegistry, {ISite} from "../services/ISiteRegistry";
import ILogger from "../services/ILogger";

interface IExecResult {
    ok: boolean;
    reason?: string;
}

interface IPending {
    site: ISite;
    commit: string;
    meta: IDeployMeta;
}

export default class DeployRunner implements IDeployRunner {
    readonly #logger: ILogger;
    readonly #store: IDeployStateStore;
    readonly #registry: ISiteRegistry;
    readonly #reposDir: string;
    readonly #logsDir: string;
    readonly #homeDir: string;
    readonly #gitTimeoutMs: number;
    readonly #buildTimeoutMs: number;
    readonly #publishTimeoutMs: number;
    readonly #logTailLines: number;

    readonly #pending = new Map<string, IPending>();
    #runningSite: string | null = null;

    constructor(
        logger: ILogger,
        store: IDeployStateStore,
        registry: ISiteRegistry,
        reposDir: string,
        logsDir: string,
        gitTimeoutMs: number,
        buildTimeoutMs: number,
        publishTimeoutMs: number,
        logTailLines: number,
    ) {
        this.#logger = logger.clone('[Deploy]');
        this.#store = store;
        this.#registry = registry;
        this.#reposDir = reposDir;
        this.#logsDir = logsDir;
        this.#homeDir = join(reposDir, '.home');
        this.#gitTimeoutMs = gitTimeoutMs;
        this.#buildTimeoutMs = buildTimeoutMs;
        this.#publishTimeoutMs = publishTimeoutMs;
        this.#logTailLines = logTailLines;

        mkdirSync(this.#reposDir, {recursive: true});
        mkdirSync(this.#logsDir, {recursive: true});
        mkdirSync(this.#homeDir, {recursive: true});
    }

    trigger(site: ISite, commit: string, meta: IDeployMeta): void {
        const replaced = this.#pending.get(site.name);
        this.#pending.set(site.name, {site, commit, meta});
        if (replaced) {
            this.#logger.info(`site=${site.name} coalesced queued commit ${replaced.commit} -> ${commit}`);
        }
        void this.#pump();
    }

    isBuilding(site: string): boolean {
        return this.#runningSite === site;
    }

    // Marks any deploy left BUILDING by a crash or restart as failed, so the
    // dashboard cannot show a build that no process is running any more.
    async reconcileInterrupted(): Promise<void> {
        for (const site of this.#registry.list()) {
            const state = await this.#store.latest(site.name);
            if (state?.status !== 'BUILDING') continue;

            this.#logger.error(`site=${site.name} commit=${state.commit} was BUILDING at startup - marking FAILED (interrupted)`);
            await this.#store.save({
                ...state,
                status: 'FAILED',
                finishedAt: Date.now(),
                durationMs: Date.now() - state.startedAt,
                error: 'interrupted by restart',
            });
        }
    }

    async #pump(): Promise<void> {
        if (this.#runningSite) return;

        const next = this.#pending.entries().next();
        if (next.done) return;

        const [name, {site, commit, meta}] = next.value;
        this.#pending.delete(name);
        this.#runningSite = name;

        try {
            await this.#run(site, commit, meta);
        } catch (e) {
            this.#logger.error(`site=${name} commit=${commit} runner crashed: ${(e as Error).message}`);
        } finally {
            this.#runningSite = null;
            void this.#pump();
        }
    }

    async #run(site: ISite, commit: string, meta: IDeployMeta): Promise<void> {
        const startedAt = Date.now();
        const logFile = join(this.#logsDir, `${site.name}-${startedAt}-${commit.slice(0, 7)}.log`);
        const state: IDeployState = {
            site: site.name,
            status: 'BUILDING',
            branch: site.branch,
            commit,
            startedAt,
            author: meta.author,
            commitMessage: meta.commitMessage,
            logFile,
        };
        await this.#store.save(state);
        this.#logger.info(`site=${site.name} commit=${commit} start log=${logFile}`);

        const log = createWriteStream(logFile, {flags: 'a'});
        const tail: string[] = [];
        let result: IExecResult;
        try {
            result = await this.#deploy(site, commit, log, tail);
        } catch (e) {
            result = {ok: false, reason: (e as Error).message};
        } finally {
            log.end();
        }

        const finishedAt = Date.now();
        const durationMs = finishedAt - startedAt;
        if (result.ok) {
            this.#logger.info(`site=${site.name} commit=${commit} SUCCESS in ${durationMs}ms`);
            await this.#store.save({...state, status: 'SUCCESS', finishedAt, durationMs});
            return;
        }

        this.#logger.error(`site=${site.name} commit=${commit} FAILED in ${durationMs}ms: ${result.reason}`);
        for (const line of tail) {
            this.#logger.error(`site=${site.name} | ${line}`);
        }
        await this.#store.save({...state, status: 'FAILED', finishedAt, durationMs, error: result.reason});
    }

    async #deploy(site: ISite, commit: string, log: WriteStream, tail: string[]): Promise<IExecResult> {
        // Fail before spending a build on a publish target that cannot be written:
        // a missing or read-only bind mount is the usual cause.
        if (!existsSync(site.publishDir)) {
            return {ok: false, reason: `publishDir ${site.publishDir} does not exist`};
        }
        try {
            accessSync(site.publishDir, constants.W_OK);
        } catch {
            return {ok: false, reason: `publishDir ${site.publishDir} is not writable`};
        }

        const repoDir = join(this.#reposDir, site.name);
        const checkedOut = await this.#checkout(site, commit, repoDir, log, tail);
        if (!checkedOut.ok) return checkedOut;

        const installed = await this.#exec(site.installCmd[0], site.installCmd.slice(1),
            repoDir, {}, this.#buildTimeoutMs, log, tail);
        if (!installed.ok) return {ok: false, reason: `install failed: ${installed.reason}`};

        const built = await this.#exec(site.buildCmd[0], site.buildCmd.slice(1),
            repoDir, {}, this.#buildTimeoutMs, log, tail);
        if (!built.ok) return {ok: false, reason: `build failed: ${built.reason}`};

        const outDir = join(repoDir, site.outputDir);
        if (!existsSync(join(outDir, 'index.html'))) {
            return {ok: false, reason: `build produced no ${site.outputDir}/index.html`};
        }

        return this.#publish(outDir, site.publishDir, log, tail);
    }

    async #checkout(site: ISite, commit: string, repoDir: string, log: WriteStream, tail: string[]): Promise<IExecResult> {
        if (!existsSync(join(repoDir, '.git'))) {
            const cloned = await this.#clone(site, repoDir, log, tail);
            if (!cloned.ok) return cloned;
        }

        const fetched = await this.#exec('git', ['fetch', '--prune', 'origin', site.branch],
            repoDir, {}, this.#gitTimeoutMs, log, tail);
        if (!fetched.ok) {
            // The checkout can outlive the remote it came from - a deleted and
            // recreated repo, a killed clone, a corrupted object. Rather than
            // failing every deploy from here on, throw it away and start over.
            this.#logger.error(`site=${site.name} fetch failed (${fetched.reason}) - discarding checkout and cloning fresh`);
            log.write(`\nfetch failed, re-cloning from scratch\n`);
            const recloned = await this.#clone(site, repoDir, log, tail);
            if (!recloned.ok) return {ok: false, reason: `git fetch failed (${fetched.reason}) and re-clone failed: ${recloned.reason}`};
        }

        // A signed payload only proves GitHub sent it, not that the commit was ever
        // merged. Without this, replaying an old delivery - or forging one with a
        // leaked secret - publishes any commit in the repo, including unmerged
        // branch tips, walking straight around branch protection and CI gates.
        const onBranch = await this.#exec('git', ['merge-base', '--is-ancestor', commit, `origin/${site.branch}`],
            repoDir, {}, this.#gitTimeoutMs, log, tail);
        if (!onBranch.ok) {
            return {ok: false, reason: `commit ${commit} is not an ancestor of origin/${site.branch} - refusing to publish it`};
        }

        // Reset to the exact pushed commit, never to the branch tip: a push landing
        // mid-build would otherwise get published under the previous commit's name.
        const reset = await this.#exec('git', ['reset', '--hard', commit],
            repoDir, {}, this.#gitTimeoutMs, log, tail);
        if (!reset.ok) return {ok: false, reason: `git reset to ${commit} failed: ${reset.reason}`};

        const cleaned = await this.#exec('git', ['clean', '-fd', '-e', 'node_modules'],
            repoDir, {}, this.#gitTimeoutMs, log, tail);
        if (!cleaned.ok) return {ok: false, reason: `git clean failed: ${cleaned.reason}`};

        return {ok: true};
    }

    async #clone(site: ISite, repoDir: string, log: WriteStream, tail: string[]): Promise<IExecResult> {
        // Never try to repair a checkout in place: a half-written one from a
        // killed clone would poison every later fetch the same way.
        rmSync(repoDir, {recursive: true, force: true});
        // --single-branch so commits from unmerged branches never exist locally:
        // if the ancestry check below ever fails open, there is still nothing off
        // the deploy branch for a reset to land on.
        const cloned = await this.#exec('git', ['clone', '--single-branch', '--branch', site.branch, site.repo, repoDir],
            this.#reposDir, {}, this.#gitTimeoutMs, log, tail);
        if (!cloned.ok) return {ok: false, reason: `git clone failed: ${cloned.reason}`};
        return {ok: true};
    }

    // Three passes so the site is never serving a half-swapped build: new
    // fingerprinted assets land beside the old ones, index.html flips in one
    // rename, and only then do the files the new build dropped get removed.
    async #publish(outDir: string, publishDir: string, log: WriteStream, tail: string[]): Promise<IExecResult> {
        const protectAcme = ['--filter', 'protect /.well-known/***'];
        const src = `${outDir}/`;
        const dst = `${publishDir}/`;

        const assets = await this.#exec('rsync', ['-a', ...protectAcme, '--exclude', '/index.html', src, dst],
            outDir, {}, this.#publishTimeoutMs, log, tail);
        if (!assets.ok) return {ok: false, reason: `publishing assets failed: ${assets.reason}`};

        const live = join(publishDir, 'index.html');
        const staged = join(publishDir, '.index.html.staged');
        try {
            copyFileSync(join(outDir, 'index.html'), staged);
            renameSync(staged, live);
            log.write('\npublished index.html\n');
        } catch (e) {
            rmSync(staged, {force: true});
            return {ok: false, reason: `publishing index.html failed: ${(e as Error).message}`};
        }

        const pruned = await this.#exec('rsync', ['-a', '--delete', ...protectAcme, src, dst],
            outDir, {}, this.#publishTimeoutMs, log, tail);
        if (!pruned.ok) return {ok: false, reason: `pruning old files failed: ${pruned.reason}`};

        return {ok: true};
    }

    #exec(
        command: string,
        args: string[],
        cwd: string,
        extraEnv: Record<string, string>,
        timeoutMs: number,
        log: WriteStream,
        tail: string[],
    ): Promise<IExecResult> {
        return new Promise(resolve => {
            log.write(`\n$ ${command} ${args.join(' ')}\n`);

            // The deploy script comes from the site repo, so it runs with a minimal
            // env: webhook secrets and the redis url must never be readable by it.
            const child = spawn(command, args, {
                cwd,
                env: {
                    PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
                    HOME: this.#homeDir,
                    TZ: process.env.TZ ?? 'UTC',
                    ...extraEnv,
                },
                timeout: timeoutMs,
                killSignal: 'SIGKILL',
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            const capture = (chunk: Buffer) => {
                log.write(chunk);
                for (const line of chunk.toString('utf8').split('\n')) {
                    if (!line.trim()) continue;
                    tail.push(line);
                    if (tail.length > this.#logTailLines) tail.shift();
                }
            };
            child.stdout.on('data', capture);
            child.stderr.on('data', capture);

            child.on('error', e => {
                log.write(`spawn error: ${e.message}\n`);
                resolve({ok: false, reason: `cannot run ${command}: ${e.message}`});
            });

            child.on('close', (code, signal) => {
                if (signal === 'SIGKILL') {
                    resolve({ok: false, reason: `timed out after ${timeoutMs}ms`});
                    return;
                }
                if (code !== 0) {
                    // Not just the last line: npm and yarn both sign off with a
                    // "visit our docs" line, which would bury the actual cause.
                    const why = tail.slice(-3).join(' | ').slice(0, 300);
                    resolve({ok: false, reason: `exit ${code}${why ? ` - ${why}` : ''}`});
                    return;
                }
                resolve({ok: true});
            });
        });
    }
}

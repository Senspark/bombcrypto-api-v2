import {spawn} from "node:child_process";
import {
    accessSync,
    constants,
    copyFileSync,
    createWriteStream,
    existsSync,
    mkdirSync,
    readdirSync,
    renameSync,
    rmSync,
    statSync,
    WriteStream,
} from "node:fs";
import {join} from "node:path";
import IDeployRunner, {IDeployMeta} from "../services/IDeployRunner";
import IDeployStateStore, {IDeployState} from "../services/IDeployStateStore";
import ISiteRegistry, {ISite} from "../services/ISiteRegistry";
import ILogger from "../services/ILogger";
import {DeployKind, SHA_REGEX} from "../consts/Consts";

interface IExecResult {
    ok: boolean;
    reason?: string;
    // Set on a success that still has something to say.
    warning?: string;
    // A pr build learns which commit it built only after fetching the ref.
    commit?: string;
}

interface IPending {
    kind: DeployKind;
    site: ISite;
    // The commit to build or to restore. Empty for a pr build, which names a
    // pull request instead.
    commit: string;
    prNumber?: number;
    meta: IDeployMeta;
}

export default class DeployRunner implements IDeployRunner {
    readonly #logger: ILogger;
    readonly #store: IDeployStateStore;
    readonly #registry: ISiteRegistry;
    readonly #reposDir: string;
    readonly #logsDir: string;
    readonly #backupDir: string;
    readonly #backupKeep: number;
    readonly #homeDir: string;
    readonly #gitTimeoutMs: number;
    readonly #buildTimeoutMs: number;
    readonly #publishTimeoutMs: number;
    readonly #logTailLines: number;

    // Keyed by site and kind, so a branch build, a pull request build and a
    // rollback for the same site queue behind each other instead of overwriting
    // each other. Two of the same kind still collapse into one, which is what
    // should happen.
    readonly #pending = new Map<string, IPending>();
    #runningSite: string | null = null;

    constructor(
        logger: ILogger,
        store: IDeployStateStore,
        registry: ISiteRegistry,
        reposDir: string,
        logsDir: string,
        backupDir: string,
        backupKeep: number,
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
        this.#backupDir = backupDir;
        this.#backupKeep = backupKeep;
        this.#homeDir = join(reposDir, '.home');
        this.#gitTimeoutMs = gitTimeoutMs;
        this.#buildTimeoutMs = buildTimeoutMs;
        this.#publishTimeoutMs = publishTimeoutMs;
        this.#logTailLines = logTailLines;

        mkdirSync(this.#reposDir, {recursive: true});
        mkdirSync(this.#logsDir, {recursive: true});
        mkdirSync(this.#homeDir, {recursive: true});
        mkdirSync(this.#backupDir, {recursive: true});
    }

    trigger(site: ISite, commit: string, meta: IDeployMeta): void {
        const replaced = this.#queue({kind: 'build', site, commit, meta});
        if (replaced) {
            this.#logger.info(`site=${site.name} coalesced queued commit ${replaced.commit} -> ${commit}`);
        }
    }

    previewPr(site: ISite, prNumber: number, actor: string): void {
        const replaced = this.#queue({kind: 'pr', site, commit: '', prNumber, meta: {actor}});
        if (replaced) {
            this.#logger.info(`site=${site.name} replaced queued preview of PR #${replaced.prNumber} -> #${prNumber} (by ${actor})`);
        }
    }

    rollback(site: ISite, commit: string, actor: string): void {
        // A build of the deploy branch publishes production, so one already
        // queued would undo the rollback the moment the lock frees. It is not
        // dropped - it may well be the fix - but it must not go unnoticed.
        const queuedBuild = this.#pending.get(this.#key(site.name, 'build'));
        if (queuedBuild) {
            this.#logger.error(`site=${site.name} rollback to ${commit} by ${actor} while build of ${queuedBuild.commit} is queued - that build will publish after the rollback`);
        }
        this.#queue({kind: 'rollback', site, commit, meta: {actor}});
    }

    isBuilding(site: string): boolean {
        return this.#runningSite === site;
    }

    backups(siteName: string): string[] {
        const dir = join(this.#backupDir, siteName);
        let entries;
        try {
            entries = readdirSync(dir, {withFileTypes: true});
        } catch (e) {
            const code = (e as NodeJS.ErrnoException).code;
            // Nothing archived yet is the normal state of a new site.
            if (code !== 'ENOENT') {
                this.#logger.error(`site=${siteName} cannot list backups in ${dir}: ${(e as Error).message}`);
            }
            return [];
        }

        return entries
            .filter(entry => entry.isDirectory())
            .map(entry => ({commit: entry.name, at: this.#mtime(join(dir, entry.name))}))
            .sort((a, b) => b.at - a.at)
            .map(entry => entry.commit);
    }

    // Marks any deploy left BUILDING by a crash or restart as failed, so the
    // dashboard cannot show a build that no process is running any more.
    async reconcileInterrupted(): Promise<void> {
        for (const site of this.#registry.list()) {
            const state = await this.#store.latest(site.name);
            if (state?.status !== 'BUILDING') continue;

            this.#logger.error(`site=${site.name} kind=${state.kind ?? 'build'} commit=${state.commit} was BUILDING at startup - marking FAILED (interrupted)`);
            await this.#store.save({
                ...state,
                status: 'FAILED',
                finishedAt: Date.now(),
                durationMs: Date.now() - state.startedAt,
                error: 'interrupted by restart',
            });
        }
    }

    #key(siteName: string, kind: DeployKind): string {
        return `${siteName}:${kind}`;
    }

    #queue(pending: IPending): IPending | undefined {
        const key = this.#key(pending.site.name, pending.kind);
        const replaced = this.#pending.get(key);
        this.#pending.set(key, pending);
        void this.#pump();
        return replaced;
    }

    #mtime(path: string): number {
        try {
            return statSync(path).mtimeMs;
        } catch {
            return 0;
        }
    }

    async #pump(): Promise<void> {
        if (this.#runningSite) return;

        const next = this.#pending.entries().next();
        if (next.done) return;

        const [key, pending] = next.value;
        this.#pending.delete(key);
        this.#runningSite = pending.site.name;

        try {
            await this.#run(pending);
        } catch (e) {
            this.#logger.error(`site=${pending.site.name} kind=${pending.kind} commit=${pending.commit} runner crashed: ${(e as Error).message}`);
        } finally {
            this.#runningSite = null;
            void this.#pump();
        }
    }

    async #run(pending: IPending): Promise<void> {
        const {kind, site, commit, prNumber, meta} = pending;
        const startedAt = Date.now();
        const label = prNumber ? `pr${prNumber}` : commit.slice(0, 7);
        const logFile = join(this.#logsDir, `${site.name}-${startedAt}-${kind}-${label}.log`);
        const state: IDeployState = {
            site: site.name,
            kind,
            status: 'BUILDING',
            branch: site.branch,
            commit,
            prNumber,
            startedAt,
            author: meta.author,
            commitMessage: meta.commitMessage,
            actor: meta.actor,
            logFile,
        };
        await this.#store.save(state);
        this.#logger.info(`site=${site.name} kind=${kind} ${label}${meta.actor ? ` by ${meta.actor}` : ''} start log=${logFile}`);

        const log = createWriteStream(logFile, {flags: 'a'});
        const tail: string[] = [];
        let result: IExecResult;
        try {
            result = await this.#execute(pending, log, tail);
        } catch (e) {
            result = {ok: false, reason: (e as Error).message};
        } finally {
            log.end();
        }

        const finishedAt = Date.now();
        const durationMs = finishedAt - startedAt;
        // A pr build knows its commit only now, and reports it even on failure -
        // knowing which head failed is the point of the message.
        const built = {...state, commit: result.commit ?? state.commit};
        if (result.ok) {
            this.#logger.info(`site=${site.name} kind=${kind} ${label} commit=${built.commit} SUCCESS in ${durationMs}ms${result.warning ? ` (${result.warning})` : ''}`);
            await this.#store.save({...built, status: 'SUCCESS', finishedAt, durationMs, warning: result.warning});
            return;
        }

        this.#logger.error(`site=${site.name} kind=${kind} ${label} FAILED in ${durationMs}ms: ${result.reason}`);
        for (const line of tail) {
            this.#logger.error(`site=${site.name} | ${line}`);
        }
        await this.#store.save({...built, status: 'FAILED', finishedAt, durationMs, error: result.reason});
    }

    #execute(pending: IPending, log: WriteStream, tail: string[]): Promise<IExecResult> {
        const {kind, site, commit, prNumber} = pending;
        switch (kind) {
            case 'pr':
                return this.#deployPr(site, prNumber!, log, tail);
            case 'rollback':
                return this.#rollback(site, commit, log, tail);
            default:
                return this.#deploy(site, commit, log, tail);
        }
    }

    #writable(dir: string, label: string): IExecResult {
        // Fail before spending a build on a target that cannot be written: a
        // missing or read-only bind mount is the usual cause.
        if (!existsSync(dir)) {
            return {ok: false, reason: `${label} ${dir} does not exist`};
        }
        try {
            accessSync(dir, constants.W_OK);
        } catch {
            return {ok: false, reason: `${label} ${dir} is not writable`};
        }
        return {ok: true};
    }

    // Merging into the deploy branch is the gate to production: there is no
    // second button after it. What lands here is what the reviewers looked at
    // on preview while the pull request was still open.
    async #deploy(site: ISite, commit: string, log: WriteStream, tail: string[]): Promise<IExecResult> {
        const publish = this.#writable(site.publishDir, 'publishDir');
        if (!publish.ok) return publish;

        const repoDir = join(this.#reposDir, site.name);
        const checkedOut = await this.#checkout(site, commit, repoDir, log, tail);
        if (!checkedOut.ok) return checkedOut;

        const built = await this.#build(site, repoDir, false, log, tail);
        if (!built.ok) return built;

        const published = await this.#publish(join(repoDir, site.outputDir), site.publishDir, log, tail);
        if (!published.ok) return published;

        // Production is live and correct from here on, so nothing below can fail
        // the deploy: the only thing an archive failure costs is the ability to
        // roll back *to* this version later.
        const archived = await this.#archive(site, commit, join(repoDir, site.outputDir), log, tail);
        this.#prune(site, commit);
        return {ok: true, warning: archived.ok ? undefined : `not archived, so this version cannot be rolled back to: ${archived.reason}`};
    }

    // A pull request head is code nobody has merged, and building it runs that
    // code. It reaches preview only, never a production web root, and its
    // install runs with --ignore-scripts so a dependency's lifecycle hook is not
    // the easiest way in.
    async #deployPr(site: ISite, prNumber: number, log: WriteStream, tail: string[]): Promise<IExecResult> {
        const preview = this.#writable(site.previewDir, 'previewDir');
        if (!preview.ok) return preview;

        const repoDir = join(this.#reposDir, site.name);
        if (!existsSync(join(repoDir, '.git'))) {
            const cloned = await this.#clone(site, repoDir, log, tail);
            if (!cloned.ok) return cloned;
        }

        const ref = `refs/pull/${prNumber}/head`;
        const fetched = await this.#exec('git', ['fetch', '--force', 'origin', `${ref}:${ref}`],
            repoDir, {}, this.#gitTimeoutMs, log, tail);
        if (!fetched.ok) return {ok: false, reason: `fetching ${ref} failed: ${fetched.reason} - is the pull request open?`};

        const commit = await this.#revParse(ref, repoDir, log, tail);
        if (!commit) return {ok: false, reason: `cannot resolve ${ref} to a commit`};

        const reset = await this.#exec('git', ['reset', '--hard', commit],
            repoDir, {}, this.#gitTimeoutMs, log, tail);
        if (!reset.ok) return {ok: false, reason: `git reset to ${commit} failed: ${reset.reason}`, commit};

        const cleaned = await this.#exec('git', ['clean', '-fd', '-e', 'node_modules'],
            repoDir, {}, this.#gitTimeoutMs, log, tail);
        if (!cleaned.ok) return {ok: false, reason: `git clean failed: ${cleaned.reason}`, commit};

        const built = await this.#build(site, repoDir, true, log, tail);
        if (!built.ok) return {...built, commit};

        const published = await this.#publish(join(repoDir, site.outputDir), site.previewDir, log, tail);
        return {...published, commit};
    }

    async #build(site: ISite, repoDir: string, ignoreScripts: boolean, log: WriteStream, tail: string[]): Promise<IExecResult> {
        const installArgs = site.installCmd.slice(1);
        if (ignoreScripts) installArgs.push('--ignore-scripts');

        const installed = await this.#exec(site.installCmd[0], installArgs,
            repoDir, {}, this.#buildTimeoutMs, log, tail);
        if (!installed.ok) return {ok: false, reason: `install failed: ${installed.reason}`};

        const built = await this.#exec(site.buildCmd[0], site.buildCmd.slice(1),
            repoDir, {}, this.#buildTimeoutMs, log, tail);
        if (!built.ok) return {ok: false, reason: `build failed: ${built.reason}`};

        if (!existsSync(join(repoDir, site.outputDir, 'index.html'))) {
            return {ok: false, reason: `build produced no ${site.outputDir}/index.html`};
        }
        return {ok: true};
    }

    #revParse(ref: string, repoDir: string, log: WriteStream, tail: string[]): Promise<string | null> {
        return new Promise(resolve => {
            const child = spawn('git', ['rev-parse', ref], {
                cwd: repoDir,
                env: {PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: this.#homeDir},
                timeout: this.#gitTimeoutMs,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let out = '';
            child.stdout.on('data', (c: Buffer) => {
                out += c.toString('utf8');
                log.write(c);
            });
            child.stderr.on('data', (c: Buffer) => {
                log.write(c);
                tail.push(c.toString('utf8').trim());
            });
            child.on('error', e => {
                this.#logger.error(`git rev-parse ${ref} could not run: ${e.message}`);
                resolve(null);
            });
            child.on('close', code => {
                const sha = out.trim();
                if (code !== 0 || !SHA_REGEX.test(sha)) {
                    this.#logger.error(`git rev-parse ${ref} exited ${code} with "${sha}"`);
                    resolve(null);
                    return;
                }
                resolve(sha);
            });
        });
    }

    async #rollback(site: ISite, commit: string, log: WriteStream, tail: string[]): Promise<IExecResult> {
        const backupDir = join(this.#backupDir, site.name, commit);
        if (!existsSync(join(backupDir, 'index.html'))) {
            return {ok: false, reason: `no archived copy of ${commit.slice(0, 7)} for ${site.name} - it has been pruned or was never archived`};
        }

        const publish = this.#writable(site.publishDir, 'publishDir');
        if (!publish.ok) return publish;

        // Nothing new is archived: this version is already in backup/, and the
        // version being replaced was archived when it was built.
        return this.#publish(backupDir, site.publishDir, log, tail);
    }

    async #archive(site: ISite, commit: string, srcDir: string, log: WriteStream, tail: string[]): Promise<IExecResult> {
        const dest = join(this.#backupDir, site.name, commit);
        try {
            mkdirSync(dest, {recursive: true});
        } catch (e) {
            return {ok: false, reason: `cannot create ${dest}: ${(e as Error).message}`};
        }

        // --delete so re-promoting the same commit cannot leave files from an
        // earlier copy of it behind.
        const copied = await this.#exec('rsync', ['-a', '--delete', `${srcDir}/`, `${dest}/`],
            this.#backupDir, {}, this.#publishTimeoutMs, log, tail);
        if (!copied.ok) {
            this.#logger.error(`site=${site.name} commit=${commit} archive to ${dest} failed: ${copied.reason}`);
            return {ok: false, reason: copied.reason};
        }
        this.#logger.info(`site=${site.name} commit=${commit} archived to ${dest}`);
        return {ok: true};
    }

    #prune(site: ISite, liveCommit: string): void {
        const dir = join(this.#backupDir, site.name);
        // Never the commit production is serving, whatever its age: it is the
        // one copy a rollback is most likely to be undone by.
        const stale = this.backups(site.name).slice(this.#backupKeep).filter(commit => commit !== liveCommit);

        for (const commit of stale) {
            try {
                rmSync(join(dir, commit), {recursive: true, force: true});
                this.#logger.info(`site=${site.name} pruned backup ${commit}`);
            } catch (e) {
                this.#logger.error(`site=${site.name} cannot prune backup ${commit}: ${(e as Error).message}`);
            }
        }
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

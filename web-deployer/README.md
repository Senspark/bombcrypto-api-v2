# web-deployer

Receives GitHub push webhooks and rebuilds the static websites they belong to.

For each configured site: verify the webhook signature, check out the exact
commit that was pushed, install, build, and publish the result into the
directory nginx serves. The whole procedure lives here - a site repo contributes
its source, not its deploy steps.

## Two processes, one image

Building a JS project means executing that project's code, so the half that does
the building holds nothing worth stealing.

| | receiver (`dist/Receiver.js`) | builder (`dist/Builder.js`) |
|---|---|---|
| runs site code | never | always |
| webhook secrets | yes | no |
| trigger signing key | private half | public half |
| Slack webhook url | yes | no |
| web roots, checkouts | no | yes |
| reachable from nginx | yes | no |

The receiver verifies the GitHub signature, then asks the builder to build. The
builder answers only to requests carrying an Ed25519 signature it can verify
with the public key - a shared secret would be readable by the very builds it is
meant to gate.

Traffic is one-directional: the receiver polls the builder for state, the builder
never calls out. That is deliberate. If the builder pushed its results instead,
that endpoint would be a button a compromised build could press to put words in
a private Slack channel.

## Endpoints

Receiver:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/hooks/:site` | GitHub push webhook. Returns 202 and builds asynchronously. |
| `GET`  | `/api/sites` | Sites, their status and their recent builds. |
| `GET`  | `/health` | Health check. |
| `GET`  | `/` | Read-only status dashboard. |

The webhook answers 401 on a bad signature, 404 on an unknown site, 502 when the
builder cannot be reached, and 204 for anything it deliberately ignores (non-push
events, other branches, branch deletions). It replies 202 before building because
GitHub times out after 10s.

Builder, reachable only from the receiver's network:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/trigger` | Signed build request. |
| `GET`  | `/api/builds` | Full state, error text included. |
| `GET`  | `/health` | Health check. |

## Configuration

`sites.json` (see `sites.example.json`) is mounted read-only into both processes:

| Field | Meaning |
|-------|---------|
| `name` | URL segment of the webhook, and the `WEBHOOK_SECRET_<NAME>` suffix. |
| `repo` | HTTPS clone url. Public repos only - this host has no deploy keys. |
| `branch` | Only pushes to this branch build. |
| `publishDir` | Directory the built site is published into. Must exist and be writable. |
| `installCmd` | Optional, default `npm ci`. |
| `buildCmd` | Optional, default `npm run build`. |
| `outputDir` | Optional, default `dist`. Must be inside the repo. |
| `url` | Optional. Where the site is served. Used to name it in notifications; nothing reads it back. |

Commands run without a shell, so they are split on whitespace and cannot carry
pipes, redirects or `&&`.

Secrets stay out of that file. The receiver reads `WEBHOOK_SECRET_<NAME>` per
site (name uppercased, dashes become underscores) and aborts startup if one is
missing, rather than accepting unverified webhooks. The builder reads no secret
at all.

`npm run keygen` prints a fresh `TRIGGER_PRIVATE_KEY` / `TRIGGER_PUBLIC_KEY`
pair. Give the private half to the receiver only.

## How a deploy runs

1. Receiver verifies the GitHub signature, reads `ref`, `after`, and the
   authorship fields, and signs a trigger for the builder.
2. Builder checks `publishDir` exists and is writable, before spending a build.
3. Clone if needed, `git fetch`, refuse a commit that is not an ancestor of the
   deploy branch, `git reset --hard <pushed sha>`, `git clean` (keeping
   `node_modules` as a cache).
4. `installCmd`, then `buildCmd`.
5. Require `outputDir/index.html`, otherwise fail without touching the live site.
6. Publish in three passes: new fingerprinted assets first, `index.html` by
   atomic rename, then delete what the new build no longer ships.
   `/.well-known/` is protected from that delete so an ACME challenge survives.

Any failing step marks the deploy failed and leaves the live site alone. All
output is captured to a file under `LOGS_DIR`.

## Behaviour worth knowing

- **One build at a time, across all sites.** Builds are short, and serialising
  them removes any chance of two builds competing for memory on the host.
- **Bursts collapse.** A site pushed again while a build is running keeps only
  the newest commit, so ten pushes in a row build once, not ten times.
- **The pushed commit is what gets built.** The checkout is reset to the SHA
  from the payload, never to the branch tip.
- **Only commits on the deploy branch publish.** A signed payload proves GitHub
  sent it, not that the commit was ever merged.
- **A trigger expires.** A build can read the builder's memory, so a captured
  trigger would otherwise be replayable to roll a site back later.
- **A deploy interrupted by a restart is marked failed** on startup, so the
  dashboard never shows a build that nothing is running.
- **The last 20 builds per site are kept**, with the author and commit subject
  from the push payload.
- **Error text never reaches the dashboard.** That page has no authentication
  and build output is not meant to be public; failures go to Slack and to the
  log file. The dashboard shows that a build failed, not why.
- **Webhooks can be restricted to GitHub's published addresses.** `HOOK_IP_MODE`
  is `off`, `log` or `enforce`; `log` reports what it would have rejected without
  rejecting it. The address is read from `CF-Connecting-IP`, so this is only
  meaningful behind a CDN that sets it **and** an origin that refuses
  connections which did not come through that CDN - otherwise the header is
  attacker-supplied and the check is decorative. In `enforce` a request without
  the header is rejected, so bypassing the CDN stops deploys until the mode goes
  back to `log`.
- **A missing builder is announced, once.** Silence from a deploy pipeline reads
  exactly like nobody having pushed anything, which is why it is said out loud
  instead of left to be noticed.

## Notifications

Set `SLACK_WEBHOOK_URL` on the receiver to post every finished build to a
channel. Leave it empty and the deployer runs silently.

One message per build, when it finishes - a "building" notice would double the
traffic to say what the next message says anyway. The site is named by the host
from its `url` and links to it; the short sha links to the commit on GitHub.
`DASHBOARD_URL`, if set, is linked at the bottom of each message.

Failure messages carry the tail of the build output. Keep that channel private.

## Trust boundary

**Whoever can push to a configured branch can run arbitrary code inside the
builder.** Moving the deploy steps out of the site repos did not change that:
`npm ci` runs the repo's lifecycle scripts, `npm run build` runs the command the
repo's `package.json` defines, and the bundler config is repo-controlled code.
The only way out of it is not building on the server.

There is no sandbox inside the builder to reach for. It already drops every
capability, so it cannot construct one; a build runs as the same uid in the same
PID namespace as the process that started it, and can read `/proc/1/environ` and
every path mounted into the container. The boundary is the container itself.

So the container is kept poor:

- no docker socket, not privileged, no added capabilities
- no ssh keys, no database credentials, nothing from the prod network
- **no webhook secret, no signing key, no chat credential** - those are in the
  receiver, which does not run site code
- the only paths it can write outside itself are the sites' `publishDir`s
- resource limits, so a runaway build cannot take the host with it

What the split does **not** fix, and should not be mistaken for fixed:

- every site's `publishDir` is mounted into the one builder, so a build for one
  site can write into another site's web root
- `node_modules` and the shared npm/yarn home survive between builds, so a build
  can leave something behind for the next one
- outbound internet is open, because git and npm need it

The real control is who can push to the configured branch. Branch protection and
review on those repos is the primary defence; everything here is damage
limitation.

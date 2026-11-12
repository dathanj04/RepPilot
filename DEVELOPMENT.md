# RepPilot development

The current hosted RepPilot workspace source is in `workspace/`. The original application and README remain at the repository root. This branch preserves `main` history and does not deploy either application automatically.

## Run the workspace locally

Requires Node.js 22 or newer. No dependency install is required for the web workspace; vendor libraries and licenses are included.

```sh
cd workspace
npm run build
npm run dev -- --port 3000
```

Open http://localhost:3000. Local preview uses an in-memory bucket and a test identity. Data resets when the preview process restarts. It is for local development only; production uses authenticated platform identity and an R2 BUCKET binding.

## Validate

```sh
cd workspace
npm run build
for testfile in scripts/test*.mjs; do node "$testfile" || exit 1; done
```

Includes the 20 address-mapped Texas clinic accounts, persistent workspace, account imports/exports, routing, provider scheduling, team assignments, billing integration scaffolding, and native mobile project sources. See workspace/README.md and workspace/mobile/VALIDATION.md for configured integrations and remaining requirements. Credentials and user workspace data are not included.

Imported from hosted workspace source commit `2be4b256f527e4a5c9f01505ad65490c691ca61b`.

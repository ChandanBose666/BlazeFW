# create-blazefw

Official scaffolding CLI for BlazeFW. Sets up a new project interactively — picking your renderer target and which pillars to include — so you only install the packages you actually need.

## Usage

```bash
npx create-blazefw my-app
```

Or with a package manager:

```bash
pnpm dlx create-blazefw my-app
yarn dlx create-blazefw my-app
```

## Interactive setup

```
┌  create-blazefw
│
◇  Project name: my-app
│
◇  Renderer target
│  ● Web (React + inline styles)
│  ○ Native (React Native)
│  ○ Email (HTML strings)
│
◇  Which pillars do you want to include?
│  ◼ Zero-Fetch Sync      @blazefw/core + @blazefw/crdt + sync server
│  ◼ Sidecar Worker       @blazefw/sidecar — offloads 3rd-party scripts
│  ◼ BlazeFW Inspector      @blazefw/inspector — dev overlay (Alt+I)
│  ◼ Snapshot Boundary    @blazefw/snapshot — time-travel error recovery
│  ◼ Accessibility Layer  @blazefw/a11y + blazefw-a11y compliance CLI
│
◇  Package manager
│  ● pnpm  ○ npm  ○ yarn
│
◇  Dependencies installed.
│
└  Your project is ready!

   cd my-app
   pnpm dev
```

## What gets scaffolded

Depending on your choices, `create-blazefw` generates:

```
my-app/
├── src/
│   ├── main.tsx              — Vite entry point with injectTheme()
│   ├── App.tsx               — starter app using your chosen renderer
│   └── components/
│       └── Dashboard.blazefw.tsx  — example .blazefw.tsx component
├── vite.config.ts            — wired to @blazefw/vite-plugin
├── tsconfig.json
├── package.json              — only the @blazefw/* packages you chose
└── index.html
```

If **Zero-Fetch Sync** is selected, also generates:

```
my-app/
└── server/
    └── sync.ts               — @blazefw/sync-server starter
```

If **Accessibility Layer** is selected, also generates:

```
my-app/
└── scripts/
    └── a11y-audit.sh         — blazefw-a11y CI audit script
```

## Add a feature after setup

```bash
# From your project root
blazefw add sync        # adds @blazefw/core + @blazefw/crdt + sync server
blazefw add sidecar     # adds @blazefw/sidecar
blazefw add inspector   # adds @blazefw/inspector
blazefw add snapshot    # adds @blazefw/snapshot
blazefw add a11y        # adds @blazefw/a11y + blazefw-a11y
```

The `add` command:
- Auto-detects your package manager (pnpm → yarn → npm)
- Merges new dependencies into `package.json`
- Copies feature template files (non-destructive — does not overwrite existing files)
- Runs install automatically

## Options

```bash
# Skip interactive prompts — use defaults
npx create-blazefw my-app --default

# Specify renderer upfront
npx create-blazefw my-app --renderer web
npx create-blazefw my-app --renderer native
npx create-blazefw my-app --renderer email

# Use a specific package manager
npx create-blazefw my-app --pm npm
npx create-blazefw my-app --pm yarn
npx create-blazefw my-app --pm pnpm
```

## Minimum install (no CLI)

If you prefer to wire things up manually:

```bash
# Minimal web app
npm install @blazefw/primitives @blazefw/web
npm install -D @blazefw/vite-plugin

# Add sync
npm install @blazefw/core @blazefw/crdt
npm install @blazefw/sync-server   # server-side

# Add a11y
npm install @blazefw/a11y
```

Nexus.js: Master Action Plan (Task-by-Task)
Phase 1: The "Nervous System" (Environment Setup)
[ ] Task 1.1: Initialize the Monorepo. Create the folder structure, package.json (Root), and pnpm-workspace.yaml.

[ ] Task 1.2: Initialize the Rust Compiler. Run cargo new --lib packages/compiler.

[ ] Task 1.3: Configure Cargo.toml. Add dependencies for swc_core, serde, and wasm-bindgen.

[ ] Task 1.4: Setup the Dev Pipeline. Configure Turborepo so that running pnpm dev starts the TypeScript watcher and the Rust compiler simultaneously.

Phase 2: The "Slicer" (Pillar 1: Fluid Execution)
[ ] Task 2.1: Build the "Capability Scanner." Write a Rust function (SWC Visitor) that identifies window, document, and localStorage as Client Triggers.

[ ] Task 2.2: Build the "Secret Scanner." Write a Rust function that identifies process.env and database imports as Server Triggers.

[ ] Task 2.3: Implement the "Slicing" Logic. Create the logic to take a file and output two versions to the .nexus/ directory: module.server.js and module.client.js.

[ ] Task 2.4: Create the Vite Plugin. Write the TS code that tells Vite: "If you see a Nexus component, don't use the standard loader—use our Rust Slicer."

Phase 3: The "Universal Language" (Pillar 3: Semantic UI)
[ ] Task 3.1: Define the Core Interface. Write the TypeScript types for the four main primitives: <Stack>, <Text>, <Action>, and <Input>.

[ ] Task 3.2: Build the Web Renderer. Create the component logic that turns <Stack> into a div with Tailwind/Flexbox classes.

[ ] Task 3.3: Build the Mobile Renderer. Create the logic that maps <Stack> to a React Native View.

[ ] Task 3.4: Build the Email Renderer. Write the transpiler that turns the Semantic UI into MJML/Table-based HTML.

Phase 4: The "Invisible Pipe" (Pillar 2: Zero-Fetch Sync)
[ ] Task 4.1: The Wasm Bridge. Compile the Automerge Rust library into a WebAssembly module that the browser can run.

[ ] Task 4.2: Create the useSync Hook. Write the TS hook that connects a UI component to the Wasm-powered CRDT state.

[ ] Task 4.3: Setup the Binary Socket. Build the server-side WebSocket handler (using Bun or Node) to broadcast "Deltas" to all connected clients.

[ ] Task 4.4: Implement "Optimistic Rollbacks." Write the logic that reverts the local state if the server sends a "Rejection Frame."

Phase 5: The "Sidecar" & Polish (Performance & DX)
[ ] Task 5.1: Build the Sidecar Worker. Create the Partytown-style Web Worker script that intercepts 3rd-party tracking scripts.

[ ] Task 5.2: Build the "Nexus Inspector." Create a browser-based overlay that shows which components are Server vs. Client in real-time.

[ ] Task 5.3: Create the "Snapshot" Boundary. Implement the advanced Error Boundary that allows a component to "Time Travel" back to its last working state.

Phase 6: The "Accessibility Layer" (@nexus/a11y — Pillar 4)
Goal: Catch ~40% of WCAG 2.1 AA violations automatically (the full automatable surface),
and make the remaining ~60% impossible to ignore via explicit build-time checklists.
Differentiator: No other framework does compile-time AST a11y validation. Every other
tool is post-hoc (linter, runtime, audit). We own the render pipeline across web, native,
and email — one a11y pass, three targets.

[ ] Task 6.1: AccessibilityScanner (Rust). Add a new SWC AST visitor in packages/compiler
    following the CapabilityScanner / SecretScanner pattern. Detects: missing alt on images,
    unlabeled interactive elements (<Action> with no text child or aria-label), invalid heading
    hierarchy (h3 before h2), form fields without associated labels, empty links, positive tabindex.
    Outputs structured AccessibilityViolation JSON (rule ID, WCAG criterion, severity, location).

[ ] Task 6.2: Enforced ARIA prop types. Extend @nexus/primitives to make aria-label required
    on <Action> when no visible text child is present (conditional type narrowing). Add aria-*
    pass-through to all four primitives. Add role constraints (e.g. Action cannot have
    role="presentation"). Propagate enforcement into all three renderers (web, native, email).

[ ] Task 6.3: Runtime utilities (@nexus/a11y package). Provide: useFocusTrap (modal/drawer
    focus containment), useAnnouncer (ARIA live region for dynamic content), SkipNav component
    (keyboard bypass for repeated nav), useReducedMotion hook (prefers-reduced-motion),
    and a <VisuallyHidden> utility component.

[ ] Task 6.4: Test utilities + compliance reporter. @nexus/a11y/test wraps axe-core for
    automated test suite integration. nexus-a11y CLI command runs a full WCAG 2.1 AA audit
    and outputs: (a) automated violations found/fixed, (b) manual verification checklist
    for the ~60% that cannot be automated, (c) per-criterion coverage report. Build output
    always prints coverage summary so devs cannot miss what still needs human review.
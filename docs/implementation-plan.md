Phase 1: The Compiler Foundations (The "Slicer")
Goal: Prove that a single .tsx file can be split into Server and Client bundles automatically.

Step 1.1: Initialize a pnpm Monorepo with a packages/compiler (Rust/SWC) and packages/runtime (TS).

Step 1.2: Build the SWC Plugin (Rust): Create a "Visitor" that scans the Abstract Syntax Tree (AST) for browser globals (window, document) or server secrets (process.env, db).

Step 1.3: Implement Code Slicing: The compiler must "cut" the file. Server-only logic stays in a Node/Bun entry point; Client-only logic is bundled for the browser.

Step 1.4: Vite Integration: Create a Vite plugin that intercepts files and runs them through the Rust slicer during the build process.

Phase 2: Multi-Output Semantic UI (The "Universal UI")
Goal: Enable a single component to render on Web, Mobile, and Email.

Step 2.1: Define Semantic Primitives: Create strictly typed TS interfaces for <Stack>, <Text>, <Action>, and <Input>.

Step 2.2: Build Target Adapters:

@ultimatejs/web: Maps Primitives to HTML/Tailwind.

@ultimatejs/native: Maps Primitives to React Native views.

@ultimatejs/email: Maps Primitives to MJML/Tables.

Step 2.3: Universal Theming: Create a central JSON theme system that injects variables into all three targets simultaneously.

Phase 3: Zero-Fetch Sync & Sidecar (The "Invisible Network")
Goal: Remove fetch() calls and stop tracking scripts from blocking the UI.

Step 3.1: The Wasm Sync Engine: Compile a CRDT library (Automerge/Yjs) from Rust to WebAssembly.

Step 3.2: Binary Transport: Setup a WebSocket/WebTransport layer to stream "Deltas" (small data changes) instead of full JSON payloads.

Step 3.3: The Script Sidecar: Build a built-in Web Worker orchestrator that runs GTM/Pixels off the main thread to ensure 100% performance scores.

Phase 4: Error Resilience & Inspector
Goal: Make the "Magic" debuggable and unkillable.

Step 4.1: Snapshot Boundaries: Build the logic that "rewinds" a component to its last good state if it crashes.

Step 4.2: The Nexus Inspector: Create the devtool overlay to visualize the "Server/Client" borders on your live app.
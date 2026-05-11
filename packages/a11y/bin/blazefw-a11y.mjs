#!/usr/bin/env node
// Shebang wrapper — points to the compiled TypeScript output.
// The actual CLI logic lives in src/cli/blazefw-a11y.ts (compiled → dist/cli/blazefw-a11y.js).
import '../dist/cli/blazefw-a11y.js';

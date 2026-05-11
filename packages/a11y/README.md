# @blazefw/a11y

BlazeFW Accessibility — runtime utilities for focus management, screen reader announcements, skip navigation, and motion preferences. Includes `@blazefw/a11y/test` with axe-core helpers for Jest, and the `blazefw-a11y` CLI for WCAG 2.1 AA compliance reporting.

## Installation

```bash
npm install @blazefw/a11y
# peer dependencies
npm install react react-dom
```

## Runtime utilities

### `useFocusTrap(ref, options?)`

Traps keyboard focus inside a container — essential for modals, drawers, and dialogs. Restores focus to the previously-active element on unmount.

```tsx
import { useRef } from 'react';
import { useFocusTrap } from '@blazefw/a11y';

function Modal({ isOpen, onClose, children }) {
  const ref = useRef<HTMLDivElement>(null);

  useFocusTrap(ref, {
    enabled: isOpen,
    onEscape: onClose,   // called when user presses Escape
  });

  return (
    <div ref={ref} role="dialog" aria-modal="true">
      {children}
    </div>
  );
}
```

Tab and Shift+Tab cycle through all focusable elements inside the container. Elements with `[disabled]` or `[inert]` are excluded automatically.

### `useAnnouncer(options?)`

Sends messages to a live ARIA region — screen readers read the message aloud without moving focus. Useful for async status updates, form validation, and notifications.

```tsx
import { useAnnouncer } from '@blazefw/a11y';

function SaveButton() {
  const { announce } = useAnnouncer({ politeness: 'polite' }); // or 'assertive'

  async function handleSave() {
    await save();
    announce('Changes saved successfully');
  }

  return <button onClick={handleSave}>Save</button>;
}
```

The announcer injects a visually-hidden `aria-live` div directly into `document.body` (stable across re-renders). Repeating the same message still triggers a screen reader announcement.

### `SkipNavLink` / `SkipNavContent`

Adds a "Skip to main content" link — required for WCAG 2.4.1. Visually hidden until focused, then appears at the top of the page.

```tsx
import { SkipNavLink, SkipNavContent } from '@blazefw/a11y';

// In your layout header:
<header>
  <SkipNavLink />
  <nav>...</nav>
</header>

// At the start of your main content:
<main>
  <SkipNavContent />
  <h1>Page title</h1>
  ...
</main>
```

Custom label and target:

```tsx
<SkipNavLink label="Skip to search results" contentId="results" />
<SkipNavContent id="results" />
```

### `useReducedMotion()`

Returns `true` when the user has enabled "Reduce Motion" in their OS preferences. Use to disable or simplify animations.

```tsx
import { useReducedMotion } from '@blazefw/a11y';

function AnimatedCard({ children }) {
  const reduced = useReducedMotion();

  return (
    <div style={{
      transition: reduced ? 'none' : 'transform 300ms ease',
      transform: reduced ? 'none' : isVisible ? 'translateY(0)' : 'translateY(20px)',
    }}>
      {children}
    </div>
  );
}
```

### `VisuallyHidden`

Renders content that is invisible to sighted users but readable by screen readers. Better than `display: none` or `visibility: hidden` which hide from all users.

```tsx
import { VisuallyHidden } from '@blazefw/a11y';

// Add context to icon-only buttons
<button onClick={onClose}>
  <CloseIcon aria-hidden />
  <VisuallyHidden>Close dialog</VisuallyHidden>
</button>

// Use any HTML element
<VisuallyHidden as="span">Loading results...</VisuallyHidden>
```

---

## Test utilities — `@blazefw/a11y/test`

axe-core integration for Jest + jsdom. Drop-in helpers for accessibility audits in unit tests.

```bash
npm install -D @blazefw/a11y axe-core
```

```ts
import { renderWithA11y, expectNoViolations, runA11yAudit } from '@blazefw/a11y/test';

describe('LoginForm', () => {
  it('has no accessibility violations', async () => {
    const { container } = renderWithA11y(<LoginForm />);
    await expectNoViolations(container);
  });

  it('reports violations for debugging', async () => {
    const { container } = renderWithA11y(<BadComponent />);
    const violations = await runA11yAudit(container);
    console.log(formatViolations(violations));
  });
});
```

**Exports:**

```ts
import {
  runA11yAudit,         // runs axe-core, returns violations array
  expectNoViolations,   // throws jest assertion if violations found
  renderWithA11y,       // wraps @testing-library/react's render
  formatViolations,     // formats violations as human-readable string
} from '@blazefw/a11y/test';
```

---

## `blazefw-a11y` CLI

Audits an HTML file or URL for WCAG 2.1 AA compliance. Reports axe-core violations, a manual checklist for the ~40% of rules that cannot be automated, and a WCAG coverage table.

### Usage

```bash
# Audit an HTML file
npx blazefw-a11y audit --file ./dist/index.html

# Audit a URL (requires a running server)
npx blazefw-a11y audit --url http://localhost:3000

# Output formats
npx blazefw-a11y audit --file index.html --format json
npx blazefw-a11y audit --file index.html --format table   # default
```

### Example output

```
VIOLATIONS (3 found, sorted by impact)
────────────────────────────────────────
[critical] image-alt       — <img> elements must have alt text          (2 elements)
[serious]  label           — Form elements must have labels              (1 element)
[moderate] color-contrast  — Elements must meet contrast ratio threshold (4 elements)

MANUAL CHECKLIST (20 items)
────────────────────────────────────────
□ 1.2.2  Captions (Prerecorded)   — Check all videos have accurate captions
□ 1.3.3  Sensory Characteristics  — Instructions don't rely on shape/colour alone
...

WCAG 2.1 AA COVERAGE
────────────────────────────────────────
Principle 1 (Perceivable)   ████████░░  8/10 automated
Principle 2 (Operable)      ██████░░░░  6/10 automated
Principle 3 (Understandable)████░░░░░░  4/10 automated
Principle 4 (Robust)        ██████████  10/10 automated

SUMMARY: 3 violations, 44/50 WCAG criteria checked (automated)
```

### Exit codes

| Code | Meaning |
|---|---|
| `0` | No violations found |
| `1` | One or more violations found |
| `2` | CLI usage error |

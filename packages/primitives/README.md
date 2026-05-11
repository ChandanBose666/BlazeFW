# @blazefw/primitives

TypeScript type contracts for the four BlazeFW semantic UI primitives — `Stack`, `Text`, `Action`, and `Input`. This package contains **no runtime code**, only types. Every BlazeFW renderer (`@blazefw/web`, `@blazefw/native`, `@blazefw/email`) depends on this package for shared prop definitions.

## Installation

```bash
npm install @blazefw/primitives
```

## What's inside

### UI Primitive Props

#### `StackProps` — universal layout container

```ts
import type { StackProps } from '@blazefw/primitives';

const props: StackProps = {
  direction: 'row',        // 'row' | 'column' | 'row-reverse' | 'column-reverse'
  align: 'center',         // 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  justify: 'between',      // 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
  gap: 4,                  // SpaceValue
  padding: 6,              // SpaceValue (also paddingX, paddingY, paddingTop, etc.)
  background: 'surface',   // ColorValue
  radius: 'md',            // 'none' | 'sm' | 'md' | 'lg' | 'full'
  wrap: true,              // boolean
  flex: 1,                 // number
};
```

#### `TextProps` — universal typography

```ts
import type { TextProps } from '@blazefw/primitives';

const props: TextProps = {
  variant: 'heading',   // 'body' | 'caption' | 'label' | 'heading' | 'title' | 'display' | 'code' | 'overline'
  as: 'h1',            // HTML tag override (web only)
  weight: 'bold',      // 'thin' | 'light' | 'normal' | 'medium' | 'semibold' | 'bold'
  color: 'primary',    // ColorValue
  align: 'center',     // 'left' | 'center' | 'right'
  maxLines: 2,         // number — clamps to N lines with ellipsis
  underline: true,
  strikethrough: false,
};
```

#### `ActionProps` — universal interactive element

```ts
import type { ActionProps } from '@blazefw/primitives';

const props: ActionProps = {
  variant: 'primary',     // 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
  size: 'md',             // 'xs' | 'sm' | 'md' | 'lg'
  onPress: () => {},      // () => void
  href: '/dashboard',     // string — renders as <a> on web
  external: false,        // opens in new tab (web only)
  disabled: false,
  loading: false,
  fullWidth: false,
};
```

#### `InputProps` — universal form field

```ts
import type { InputProps } from '@blazefw/primitives';

const props: InputProps = {
  type: 'email',                   // 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'
  variant: 'outline',              // 'outline' | 'filled' | 'underline'
  fieldLabel: 'Email address',
  placeholder: 'you@example.com',
  hint: 'We will never share your email.',
  error: 'Invalid email format',
  leadingIcon: '✉',
  required: true,
  disabled: false,
  readOnly: false,
  multiline: false,
  rows: 4,
  onChange: (value: string) => {},
  onSubmit: (value: string) => {},
};
```

### Design Token Types

#### `SpaceValue` — spacing scale (maps to 4px units)

```ts
import type { SpaceValue } from '@blazefw/primitives';

// Integer tokens: 0=0px, 1=4px, 2=8px, 3=12px, 4=16px, 6=24px, 8=32px, 12=48px, 16=64px
// String passthrough: '16px', '50%', '2rem'
const space: SpaceValue = 4;       // 16px
const custom: SpaceValue = '20px'; // passthrough
```

#### `ColorToken` — semantic color names

```ts
import type { ColorToken } from '@blazefw/primitives';

// Available tokens:
// 'background' | 'surface' | 'border'
// 'primary' | 'primary-fg'
// 'secondary' | 'secondary-fg'
// 'success' | 'warning' | 'danger'
// 'muted' | 'muted-fg'
```

#### `ColorValue` — token or raw hex/rgb string

```ts
import type { ColorValue } from '@blazefw/primitives';

const a: ColorValue = 'primary';    // resolved by renderer theme
const b: ColorValue = '#e11d48';    // raw color (passthrough)
```

### Renderer Contract

```ts
import type { BlazeRenderer } from '@blazefw/primitives';

// Every render target must satisfy this contract:
interface BlazeRenderer<TNode> {
  Stack:  (props: StackProps)  => TNode;
  Text:   (props: TextProps)   => TNode;
  Action: (props: ActionProps) => TNode;
  Input:  (props: InputProps)  => TNode;
}

// Web  → TNode = ReactElement  (@blazefw/web)
// Native → TNode = ReactElement (@blazefw/native)
// Email  → TNode = string       (@blazefw/email)
```

## Related packages

| Package | Purpose |
|---|---|
| `@blazefw/web` | Renders primitives as React components |
| `@blazefw/native` | Renders primitives as React Native components |
| `@blazefw/email` | Renders primitives as MSO-safe HTML strings |

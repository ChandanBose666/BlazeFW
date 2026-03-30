import type { ReactElement, CSSProperties, ChangeEvent, KeyboardEvent } from "react";
import type { InputProps, InputVariant } from "@blazefw/primitives";
import { resolveSpace, resolveColor, FONT_SIZE } from "./lib/tokens.js";

// ---------------------------------------------------------------------------
// Static style maps (rendering-hoist-jsx)
// ---------------------------------------------------------------------------

const LABEL_STYLE: CSSProperties = {
  display:    "block",
  fontSize:   "0.875rem",
  fontWeight: 500,
  lineHeight: 1,
  marginBottom: "6px",
  color:      "var(--ultimate-muted-fg)",
};

const WRAPPER_STYLE: CSSProperties = {
  position: "relative",
  display:  "flex",
  alignItems: "center",
};

const BASE_INPUT_STYLE: CSSProperties = {
  width:      "100%",
  fontFamily: "inherit",
  fontSize:   "1rem",
  lineHeight: "1.5",
  color:      "inherit",
  outline:    "none",
  paddingTop:    "8px",
  paddingBottom: "8px",
  paddingLeft:   "12px",
  paddingRight:  "12px",
  boxSizing:  "border-box",
  // Transition for focus ring
  transition: "border-color 150ms ease, box-shadow 150ms ease",
};

const VARIANT_STYLES: Record<InputVariant, CSSProperties> = {
  outline:   {
    border:          "1px solid var(--ultimate-border)",
    borderRadius:    "6px",
    backgroundColor: "transparent",
  },
  filled:    {
    border:          "1px solid transparent",
    borderRadius:    "6px",
    backgroundColor: "var(--ultimate-surface)",
  },
  underline: {
    borderTop:       "none",
    borderLeft:      "none",
    borderRight:     "none",
    borderBottom:    "1px solid var(--ultimate-border)",
    borderRadius:    "0",
    backgroundColor: "transparent",
    paddingLeft:     "0",
    paddingRight:    "0",
  },
};

const ERROR_INPUT_STYLE: CSSProperties = {
  borderColor: "var(--ultimate-danger)",
};

const DISABLED_INPUT_STYLE: CSSProperties = {
  opacity:  0.5,
  cursor:   "not-allowed",
};

const HELPER_STYLE: CSSProperties = {
  display:   "block",
  fontSize:  "0.75rem",
  lineHeight: "1.5",
  marginTop: "4px",
};

const ERROR_HELPER_STYLE: CSSProperties = {
  ...HELPER_STYLE,
  color: "var(--ultimate-danger)",
};

const HINT_HELPER_STYLE: CSSProperties = {
  ...HELPER_STYLE,
  color: "var(--ultimate-muted-fg)",
};

const ICON_STYLE: CSSProperties = {
  position:   "absolute",
  display:    "flex",
  alignItems: "center",
  pointerEvents: "none",
  color:      "var(--ultimate-muted-fg)",
  fontSize:   "1rem",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Web implementation of the <Input> primitive.
 *
 * Renders <textarea> when `multiline` is true, <input> otherwise.
 * Wraps the field with an optional label, helper/error text, and icon slots.
 */
export function Input({
  type = "text",
  variant = "outline",
  fieldLabel,
  placeholder,
  value,
  defaultValue,
  multiline,
  rows = 3,
  maxLength,
  required,
  disabled,
  readOnly,
  error,
  hint,
  leadingIcon,
  trailingIcon,
  size,
  background,
  borderColor,
  padding,
  paddingX,
  paddingY,
  onChange,
  onSubmit,
  label,
  testId,
  "aria-autocomplete":      ariaAutocomplete,
  "aria-errormessage":      ariaErrormessage,
  "aria-activedescendant":  ariaActivedescendant,
  "aria-hidden":            ariaHidden,
  "aria-describedby":       ariaDescribedby,
  "aria-labelledby":        ariaLabelledby,
}: InputProps): ReactElement {
  const hasLeading  = leadingIcon !== undefined;
  const hasTrailing = trailingIcon !== undefined;

  // Padding overrides (least-to-most specific)
  const paddingOverride: CSSProperties = {};
  if (padding !== undefined) {
    const v = resolveSpace(padding);
    paddingOverride.paddingTop = paddingOverride.paddingBottom =
    paddingOverride.paddingLeft = paddingOverride.paddingRight = v;
  }
  if (paddingX !== undefined) {
    const v = resolveSpace(paddingX);
    paddingOverride.paddingLeft  = v;
    paddingOverride.paddingRight = v;
  }
  if (paddingY !== undefined) {
    const v = resolveSpace(paddingY);
    paddingOverride.paddingTop    = v;
    paddingOverride.paddingBottom = v;
  }

  // Icon inset adjustments so text doesn't overlap icons
  const iconInset: CSSProperties = {};
  if (hasLeading)  iconInset.paddingLeft  = "36px";
  if (hasTrailing) iconInset.paddingRight = "36px";

  const inputStyle: CSSProperties = {
    ...BASE_INPUT_STYLE,
    ...VARIANT_STYLES[variant],
    ...(error !== undefined && ERROR_INPUT_STYLE),
    ...(disabled && DISABLED_INPUT_STYLE),
    ...(size !== undefined && { fontSize: FONT_SIZE[size] }),
    ...(background !== undefined && { backgroundColor: resolveColor(background) }),
    ...(borderColor !== undefined && { borderColor: resolveColor(borderColor) }),
    ...iconInset,
    ...paddingOverride,
  };

  // Bridge UltimateJs onChange (value: string) → React onChange (event)
  const handleChange = onChange !== undefined
    ? (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)
    : undefined;

  // onSubmit fires on Enter key press (single-line only)
  const handleKeyDown = onSubmit !== undefined
    ? (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !(multiline ?? false)) {
          onSubmit((e.target as HTMLInputElement).value);
        }
      }
    : undefined;

  const sharedInputProps = {
    style:         inputStyle,
    placeholder,
    value,
    defaultValue,
    maxLength,
    required,
    disabled,
    readOnly,
    "aria-label":             label ?? fieldLabel,
    "aria-required":          required,
    "aria-invalid":           error !== undefined ? (true as const) : undefined,
    "aria-autocomplete":      ariaAutocomplete,
    "aria-errormessage":      ariaErrormessage,
    "aria-activedescendant":  ariaActivedescendant,
    // Relationship attributes must land on the focusable control, not the wrapper
    "aria-describedby":       ariaDescribedby,
    "aria-labelledby":        ariaLabelledby,
    "data-testid":            testId,
    onChange:  handleChange,
    onKeyDown: handleKeyDown,
  };

  return (
    <div
      aria-hidden={ariaHidden}
    >
      {fieldLabel !== undefined ? (
        <label style={LABEL_STYLE}>
          {fieldLabel}
          {required ? (
            <span aria-hidden="true" style={{ color: "var(--ultimate-danger)", marginLeft: "2px" }}>
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <div style={WRAPPER_STYLE}>
        {hasLeading ? (
          <span style={{ ...ICON_STYLE, left: "10px" }}>{leadingIcon}</span>
        ) : null}

        {multiline ? (
          <textarea rows={rows} {...sharedInputProps} />
        ) : (
          <input type={type} {...sharedInputProps} />
        )}

        {hasTrailing ? (
          <span style={{ ...ICON_STYLE, right: "10px" }}>{trailingIcon}</span>
        ) : null}
      </div>

      {error !== undefined ? (
        <span role="alert" style={ERROR_HELPER_STYLE}>{error}</span>
      ) : hint !== undefined ? (
        <span style={HINT_HELPER_STYLE}>{hint}</span>
      ) : null}
    </div>
  );
}

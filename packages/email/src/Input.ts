import type { InputProps } from "@blazefw/primitives";
import { DEFAULT_THEME } from "./lib/tokens.js";
import { escapeAttr, escapeHtml } from "./lib/html.js";

/**
 * Email implementation of the <Input> primitive.
 *
 * Email clients have no JavaScript runtime — interactive form inputs
 * cannot function inside an email. This renderer produces a static,
 * visually representative placeholder:
 *
 *   - `fieldLabel` renders as a label line
 *   - `placeholder` (or a blank underline) represents the input area
 *   - `hint` renders below as helper text
 *   - `error` renders below in danger color
 *   - All interactive props (onChange, onSubmit, value, etc.) are ignored
 *
 * This output is useful for email-based form previews, UI mockups,
 * and "fill this out on our website" CTAs.
 */
export function Input({
  fieldLabel,
  placeholder,
  required,
  hint,
  error,
  label,
  testId,
  // All interactive / state props are intentionally ignored:
  type: _type,
  variant: _variant,
  value: _value,
  defaultValue: _defaultValue,
  multiline: _multiline,
  rows: _rows,
  maxLength: _maxLength,
  disabled: _disabled,
  readOnly: _readOnly,
  leadingIcon: _leadingIcon,
  trailingIcon: _trailingIcon,
  size: _size,
  background: _background,
  borderColor: _borderColor,
  padding: _padding,
  paddingX: _paddingX,
  paddingY: _paddingY,
  onChange: _onChange,
  onSubmit: _onSubmit,
  // ARIA props — silently ignored in email (static placeholder only, no interactive semantics)
  "aria-autocomplete":     _ariaAutocomplete,
  "aria-errormessage":     _ariaErrormessage,
  "aria-activedescendant": _ariaActivedescendant,
  "aria-hidden":           _ariaHidden,
  "aria-describedby":      _ariaDescribedby,
  "aria-labelledby":       _ariaLabelledby,
}: InputProps): string {
  const parts: string[] = [];
  const testAttr = testId ? ` data-testid="${escapeAttr(testId)}"` : "";
  const ariaLabel = label ? ` aria-label="${escapeHtml(label)}"` : "";

  // --- Label ---
  if (fieldLabel !== undefined) {
    const requiredMark = required
      ? `<span style="color:${DEFAULT_THEME.danger};margin-left:2px;">*</span>`
      : "";

    parts.push(
      `<p style="font-size:14px;font-weight:500;margin:0 0 6px 0;color:${DEFAULT_THEME["muted-fg"]};"${ariaLabel}${testAttr}>` +
      escapeHtml(fieldLabel) + requiredMark +
      `</p>`
    );
  }

  // --- Static field representation ---
  const fieldText = placeholder !== undefined
    ? `<span style="color:${DEFAULT_THEME["muted-fg"]};">${escapeHtml(placeholder)}</span>`
    : "&nbsp;";

  const borderColor = error !== undefined ? DEFAULT_THEME.danger : DEFAULT_THEME.border;

  parts.push(
    `<p style="font-size:16px;margin:0 0 4px 0;padding:8px 0;border-bottom:1px solid ${borderColor};color:${DEFAULT_THEME["muted-fg"]};">` +
    fieldText +
    `</p>`
  );

  // --- Error ---
  if (error !== undefined) {
    parts.push(
      `<p role="alert" style="font-size:12px;margin:4px 0 0 0;color:${DEFAULT_THEME.danger};">` +
      escapeHtml(error) +
      `</p>`
    );
  // --- Hint (only if no error) ---
  } else if (hint !== undefined) {
    parts.push(
      `<p style="font-size:12px;margin:4px 0 0 0;color:${DEFAULT_THEME["muted-fg"]};">` +
      escapeHtml(hint) +
      `</p>`
    );
  }

  return parts.join("\n");
}

import type { ReactElement } from "react";
import { View, Text as RNText, TextInput, KeyboardTypeOptions } from "react-native";
import type { InputProps, InputType, InputVariant } from "@blazefw/primitives";
import { resolveSpace, resolveColor, FONT_SIZE_DP, DEFAULT_THEME } from "./lib/tokens.js";

// ---------------------------------------------------------------------------
// Keyboard type mapping (InputType → React Native KeyboardTypeOptions)
// ---------------------------------------------------------------------------

const KEYBOARD_TYPE: Record<InputType, KeyboardTypeOptions> = {
  text:     "default",
  email:    "email-address",
  password: "default",  // secureTextEntry handles masking
  number:   "numeric",
  tel:      "phone-pad",
  url:      "url",
  search:   "default",
};

// ---------------------------------------------------------------------------
// Static style maps
// ---------------------------------------------------------------------------

const LABEL_STYLE = {
  fontSize:     14,
  fontWeight:   "500" as const,
  marginBottom: 6,
  color:        DEFAULT_THEME["muted-fg"],
};

const BASE_INPUT_STYLE = {
  fontSize:         16,
  color:            "#1a1a1a",
  paddingVertical:  10,
  paddingHorizontal:12,
};

const VARIANT_STYLES: Record<InputVariant, object> = {
  outline:   {
    borderWidth:     1,
    borderColor:     DEFAULT_THEME.border,
    borderRadius:    6,
    backgroundColor: "transparent",
  },
  filled:    {
    borderWidth:     1,
    borderColor:     "transparent",
    borderRadius:    6,
    backgroundColor: DEFAULT_THEME.surface,
  },
  underline: {
    borderBottomWidth: 1,
    borderBottomColor: DEFAULT_THEME.border,
    borderRadius:      0,
    backgroundColor:   "transparent",
    paddingHorizontal: 0,
  },
};

const ERROR_BORDER_STYLE = { borderColor: DEFAULT_THEME.danger };

const HELPER_STYLE = {
  fontSize:   12,
  marginTop:  4,
  lineHeight: 18,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Native implementation of the <Input> primitive.
 * Renders as React Native's <TextInput>.
 *
 * Notes:
 *   - `leadingIcon` / `trailingIcon` render as text strings (icon name).
 *     In a real app, swap for your icon library component.
 *   - `rows` maps to `numberOfLines` (visible height hint).
 *   - `onSubmit` fires via `onSubmitEditing` (return key on native keyboard).
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
  // All new ARIA Input props have no RN TextInput equivalent — silently ignored
  "aria-autocomplete":      _ariaAutocomplete,
  "aria-errormessage":      _ariaErrormessage,
  "aria-activedescendant":  _ariaActivedescendant,
  // `aria-hidden` → importantForAccessibility on outer View
  "aria-hidden":            ariaHidden,
  "aria-describedby":       _ariaDescribedby,
  "aria-labelledby":        _ariaLabelledby,
}: InputProps): ReactElement {
  // Padding overrides
  let pv = BASE_INPUT_STYLE.paddingVertical;
  let ph = BASE_INPUT_STYLE.paddingHorizontal;

  if (padding !== undefined) {
    const v = resolveSpace(padding);
    if (v !== undefined) { pv = v; ph = v; }
  }
  if (paddingX !== undefined) { const v = resolveSpace(paddingX); if (v !== undefined) ph = v; }
  if (paddingY !== undefined) { const v = resolveSpace(paddingY); if (v !== undefined) pv = v; }

  const hasLeading  = leadingIcon !== undefined;
  const hasTrailing = trailingIcon !== undefined;

  const inputStyle = {
    ...BASE_INPUT_STYLE,
    ...VARIANT_STYLES[variant],
    ...(error !== undefined && ERROR_BORDER_STYLE),
    ...(disabled && { opacity: 0.5 }),
    ...(size !== undefined && { fontSize: FONT_SIZE_DP[size] }),
    ...(background !== undefined && { backgroundColor: resolveColor(background) }),
    ...(borderColor !== undefined && { borderColor: resolveColor(borderColor) }),
    // Inset for icons so text doesn't overlap
    ...(hasLeading  && { paddingLeft: ph + 24 }),
    ...(hasTrailing && { paddingRight: ph + 24 }),
    ...(!hasLeading  && { paddingHorizontal: undefined, paddingLeft:  ph }),
    ...(!hasTrailing && { paddingRight: ph }),
    paddingVertical: pv,
    flex: 1,
  };

  return (
    <View importantForAccessibility={ariaHidden ? "no-hide-descendants" : undefined}>
      {fieldLabel !== undefined ? (
        <RNText style={LABEL_STYLE}>
          {fieldLabel}
          {required ? (
            <RNText style={{ color: DEFAULT_THEME.danger }}>{" *"}</RNText>
          ) : null}
        </RNText>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {hasLeading ? (
          <RNText
            style={{
              position:  "absolute",
              left:      12,
              zIndex:    1,
              fontSize:  16,
              color:     DEFAULT_THEME["muted-fg"],
            }}
          >
            {leadingIcon}
          </RNText>
        ) : null}

        <TextInput
          style={inputStyle}
          placeholder={placeholder}
          placeholderTextColor={DEFAULT_THEME["muted-fg"]}
          value={value}
          defaultValue={defaultValue}
          multiline={multiline ?? false}
          numberOfLines={multiline ? rows : undefined}
          maxLength={maxLength}
          editable={!(disabled ?? false) && !(readOnly ?? false)}
          secureTextEntry={type === "password"}
          keyboardType={type !== "password" ? KEYBOARD_TYPE[type] : "default"}
          accessibilityLabel={label ?? fieldLabel}
          aria-required={required}
          aria-invalid={error !== undefined}
          testID={testId}
          onChangeText={onChange}
          onSubmitEditing={
            onSubmit !== undefined
              ? (e) => onSubmit(e.nativeEvent.text)
              : undefined
          }
        />

        {hasTrailing ? (
          <RNText
            style={{
              position: "absolute",
              right:    12,
              zIndex:   1,
              fontSize: 16,
              color:    DEFAULT_THEME["muted-fg"],
            }}
          >
            {trailingIcon}
          </RNText>
        ) : null}
      </View>

      {error !== undefined ? (
        <RNText
          accessibilityRole="alert"
          style={{ ...HELPER_STYLE, color: DEFAULT_THEME.danger }}
        >
          {error}
        </RNText>
      ) : hint !== undefined ? (
        <RNText style={{ ...HELPER_STYLE, color: DEFAULT_THEME["muted-fg"] }}>
          {hint}
        </RNText>
      ) : null}
    </View>
  );
}

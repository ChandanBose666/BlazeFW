use serde::Serialize;
use swc_core::ecma::ast::{
    JSXAttrName, JSXAttrOrSpread, JSXAttrValue, JSXElementChild, JSXExpr, JSXOpeningElement, Lit,
    Str,
};
use swc_core::ecma::visit::{Visit, VisitWith};

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------

/// WCAG 2.1 severity levels.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warning,
}

/// A single accessibility violation found in the source.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AccessibilityViolation {
    /// Short rule identifier, e.g. `"missing-alt"`.
    pub rule: String,
    /// WCAG 2.1 success criterion, e.g. `"1.1.1"`.
    pub wcag: String,
    /// Human-readable description of what went wrong.
    pub message: String,
    /// Element tag name where the violation was found.
    pub element: String,
    pub severity: Severity,
}

impl AccessibilityViolation {
    fn new(rule: &str, wcag: &str, message: &str, element: &str, severity: Severity) -> Self {
        Self {
            rule: rule.to_string(),
            wcag: wcag.to_string(),
            message: message.to_string(),
            element: element.to_string(),
            severity,
        }
    }
}

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

/// Walks JSX AST and collects WCAG 2.1 accessibility violations.
///
/// Rules:
///   | ID                  | WCAG  | What is checked                                        |
///   |---------------------|-------|--------------------------------------------------------|
///   | missing-alt         | 1.1.1 | `<img>` missing `alt` attribute                        |
///   | unlabeled-action    | 4.1.2 | `<Action>` with no text child and no `aria-label`      |
///   | heading-order       | 1.3.1 | Heading level skipped (e.g. h1 → h3)                   |
///   | missing-input-label | 1.3.1 | `<input>` / `<Input>` without label association        |
///   | empty-link          | 2.4.4 | `<a>` with no discernible text content                 |
///   | positive-tabindex   | 2.4.3 | `tabIndex` > 0 disrupts natural focus order            |
pub struct AccessibilityScanner {
    pub violations: Vec<AccessibilityViolation>,
    last_heading_level: Option<u8>,
}

impl AccessibilityScanner {
    pub fn new() -> Self {
        Self {
            violations: vec![],
            last_heading_level: None,
        }
    }

    pub fn has_violations(&self) -> bool {
        !self.violations.is_empty()
    }

    // -----------------------------------------------------------------------
    // Attribute helpers
    // -----------------------------------------------------------------------

    /// Returns the tag name of a JSX opening element (original case).
    fn tag_name(el: &JSXOpeningElement) -> String {
        match &el.name {
            swc_core::ecma::ast::JSXElementName::Ident(i) => i.sym.as_ref().to_string(),
            swc_core::ecma::ast::JSXElementName::JSXMemberExpr(m) => {
                m.prop.sym.as_ref().to_string()
            }
            swc_core::ecma::ast::JSXElementName::JSXNamespacedName(n) => {
                n.name.sym.as_ref().to_string()
            }
        }
    }

    /// Returns `true` if the opening element has an attribute with the given name.
    fn has_attr(el: &JSXOpeningElement, name: &str) -> bool {
        el.attrs.iter().any(|a| attr_name_matches(a, name))
    }

    /// Returns the numeric value of a named attribute, if it can be parsed.
    fn get_attr_num(el: &JSXOpeningElement, name: &str) -> Option<f64> {
        for a in &el.attrs {
            if !attr_name_matches(a, name) {
                continue;
            }
            if let JSXAttrOrSpread::JSXAttr(attr) = a {
                return match &attr.value {
                    // tabIndex="2"  — numeric string literal
                    Some(JSXAttrValue::Str(Str { value, .. })) => {
                        value.to_string_lossy().parse::<f64>().ok()
                    }
                    // tabIndex={2}  — numeric literal in JSX expression
                    Some(JSXAttrValue::JSXExprContainer(c)) => {
                        if let JSXExpr::Expr(e) = &c.expr {
                            match e.as_ref() {
                                swc_core::ecma::ast::Expr::Lit(Lit::Num(n)) => Some(n.value),
                                swc_core::ecma::ast::Expr::Unary(u) => {
                                    // tabIndex={-1}
                                    use swc_core::ecma::ast::{Expr, UnaryOp};
                                    if u.op == UnaryOp::Minus {
                                        if let Expr::Lit(Lit::Num(n)) = u.arg.as_ref() {
                                            return Some(-n.value);
                                        }
                                    }
                                    None
                                }
                                _ => None,
                            }
                        } else {
                            None
                        }
                    }
                    _ => None,
                };
            }
        }
        None
    }

    // -----------------------------------------------------------------------
    // Rule implementations
    // -----------------------------------------------------------------------

    /// Rule: missing-alt — `<img>` without `alt` attribute (WCAG 1.1.1).
    fn check_img(&mut self, el: &JSXOpeningElement) {
        if !Self::has_attr(el, "alt") {
            self.violations.push(AccessibilityViolation::new(
                "missing-alt",
                "1.1.1",
                "img element is missing an alt attribute",
                "img",
                Severity::Error,
            ));
        }
    }

    /// Rule: missing-input-label — `<input>` / `<Input>` without label (WCAG 1.3.1).
    fn check_input(&mut self, el: &JSXOpeningElement, raw: &str) {
        let has_label = Self::has_attr(el, "aria-label")
            || Self::has_attr(el, "aria-labelledby")
            || Self::has_attr(el, "id");
        if !has_label {
            self.violations.push(AccessibilityViolation::new(
                "missing-input-label",
                "1.3.1",
                "input element has no accessible label (needs aria-label, aria-labelledby, or id for <label for>)",
                raw,
                Severity::Error,
            ));
        }
    }

    /// Rule: positive-tabindex — `tabIndex` > 0 disrupts natural focus order (WCAG 2.4.3).
    fn check_tabindex(&mut self, el: &JSXOpeningElement) {
        let raw = Self::tag_name(el);
        // Accept both React-style `tabIndex` and HTML-style `tabindex`.
        let value = Self::get_attr_num(el, "tabIndex")
            .or_else(|| Self::get_attr_num(el, "tabindex"));
        if let Some(n) = value {
            if n > 0.0 {
                self.violations.push(AccessibilityViolation::new(
                    "positive-tabindex",
                    "2.4.3",
                    "tabIndex values greater than 0 disrupt the natural focus order",
                    &raw,
                    Severity::Warning,
                ));
            }
        }
    }

    /// Rule: heading-order — heading level skipped (WCAG 1.3.1).
    fn check_heading(&mut self, level: u8) {
        if let Some(prev) = self.last_heading_level {
            if level > prev + 1 {
                self.violations.push(AccessibilityViolation::new(
                    "heading-order",
                    "1.3.1",
                    &format!(
                        "Heading level h{} follows h{} — heading levels must not be skipped",
                        level, prev
                    ),
                    &format!("h{}", level),
                    Severity::Warning,
                ));
            }
        }
        self.last_heading_level = Some(level);
    }
}

// ---------------------------------------------------------------------------
// Visitor
// ---------------------------------------------------------------------------

impl Visit for AccessibilityScanner {
    fn visit_jsx_element(&mut self, el: &swc_core::ecma::ast::JSXElement) {
        let opening = &el.opening;
        let raw = Self::tag_name(opening);
        let tag_lc = raw.to_lowercase();

        // tabindex check applies to any element.
        self.check_tabindex(opening);

        match tag_lc.as_str() {
            "img" => self.check_img(opening),

            "h1" => self.check_heading(1),
            "h2" => self.check_heading(2),
            "h3" => self.check_heading(3),
            "h4" => self.check_heading(4),
            "h5" => self.check_heading(5),
            "h6" => self.check_heading(6),

            "input" => self.check_input(opening, &raw),

            "a" => {
                let has_label = Self::has_attr(opening, "aria-label")
                    || Self::has_attr(opening, "aria-labelledby");
                if !has_label && !children_have_visible_text(&el.children) {
                    self.violations.push(AccessibilityViolation::new(
                        "empty-link",
                        "2.4.4",
                        "Anchor element has no discernible text content",
                        "a",
                        Severity::Error,
                    ));
                }
            }

            // UltimateJs <Action> primitive — 4.1.2 Name, role, value
            "action" => {
                let has_label = Self::has_attr(opening, "aria-label")
                    || Self::has_attr(opening, "aria-labelledby");
                if !has_label && !children_have_visible_text(&el.children) {
                    self.violations.push(AccessibilityViolation::new(
                        "unlabeled-action",
                        "4.1.2",
                        "<Action> has no accessible label — add a text child or aria-label",
                        &raw,
                        Severity::Error,
                    ));
                }
            }

            _ => {}
        }

        // UltimateJs <Input> primitive (capital I, distinct from <input>).
        if raw == "Input" {
            self.check_input(opening, "Input");
        }

        el.visit_children_with(self);
    }
}

// ---------------------------------------------------------------------------
// Free helpers
// ---------------------------------------------------------------------------

/// Returns `true` if the attribute slot matches a given name string.
fn attr_name_matches(a: &JSXAttrOrSpread, name: &str) -> bool {
    if let JSXAttrOrSpread::JSXAttr(attr) = a {
        if let JSXAttrName::Ident(ident) = &attr.name {
            return ident.sym.as_ref() == name;
        }
    }
    false
}

/// Returns `true` if any JSX child carries visible text content.
fn children_have_visible_text(children: &[JSXElementChild]) -> bool {
    children.iter().any(child_has_visible_text)
}

fn child_has_visible_text(child: &JSXElementChild) -> bool {
    match child {
        JSXElementChild::JSXText(t) => !t.value.as_ref().trim().is_empty(),
        JSXElementChild::JSXExprContainer(c) => {
            // {expr} counts as potential text unless it is {/* comment */}
            !matches!(c.expr, JSXExpr::JSXEmptyExpr(_))
        }
        JSXElementChild::JSXElement(nested) => {
            // Inline SVGs or icons inside <Action><Icon/></Action> count as visible.
            let tag = match &nested.opening.name {
                swc_core::ecma::ast::JSXElementName::Ident(i) => i.sym.as_ref().to_lowercase(),
                _ => String::new(),
            };
            matches!(tag.as_str(), "svg" | "img" | "span" | "i")
                || children_have_visible_text(&nested.children)
        }
        _ => false,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use swc_core::common::{FileName, SourceMap, sync::Lrc};
    use swc_core::ecma::parser::{lexer::Lexer, Parser, StringInput, Syntax, TsSyntax};

    fn scan(src: &str) -> AccessibilityScanner {
        let cm: Lrc<SourceMap> = Default::default();
        let fm = cm.new_source_file(FileName::Anon.into(), src.to_string());
        let lexer = Lexer::new(
            Syntax::Typescript(TsSyntax {
                tsx: true,
                ..Default::default()
            }),
            Default::default(),
            StringInput::from(&*fm),
            None,
        );
        let mut parser = Parser::new_from(lexer);
        let module = parser.parse_module().expect("failed to parse");

        let mut scanner = AccessibilityScanner::new();
        scanner.visit_module(&module);
        scanner
    }

    fn has_rule(s: &AccessibilityScanner, rule: &str) -> bool {
        s.violations.iter().any(|v| v.rule == rule)
    }

    // --- missing-alt ---

    #[test]
    fn detects_missing_alt() {
        assert!(has_rule(&scan(r#"const a = <img src="x.png" />;"#), "missing-alt"));
    }

    #[test]
    fn no_violation_when_alt_present() {
        assert!(!has_rule(&scan(r#"const a = <img src="x.png" alt="A cat" />;"#), "missing-alt"));
    }

    #[test]
    fn empty_alt_is_valid_decorative_image() {
        // alt="" is intentional for decorative images — must NOT flag
        assert!(!has_rule(&scan(r#"const a = <img src="x.png" alt="" />;"#), "missing-alt"));
    }

    // --- unlabeled-action ---

    #[test]
    fn detects_unlabeled_action() {
        assert!(has_rule(&scan(r#"const a = <Action />;"#), "unlabeled-action"));
    }

    #[test]
    fn action_with_text_child_is_ok() {
        assert!(!has_rule(&scan(r#"const a = <Action>Submit</Action>;"#), "unlabeled-action"));
    }

    #[test]
    fn action_with_aria_label_is_ok() {
        assert!(!has_rule(
            &scan(r#"const a = <Action aria-label="Close dialog" />;"#),
            "unlabeled-action"
        ));
    }

    #[test]
    fn action_with_expr_child_is_ok() {
        assert!(!has_rule(
            &scan(r#"const a = <Action>{label}</Action>;"#),
            "unlabeled-action"
        ));
    }

    // --- heading-order ---

    #[test]
    fn detects_skipped_heading_level() {
        assert!(has_rule(
            &scan(r#"const a = <div><h1>Title</h1><h3>Skip!</h3></div>;"#),
            "heading-order"
        ));
    }

    #[test]
    fn sequential_headings_are_ok() {
        assert!(!has_rule(
            &scan(r#"const a = <div><h1>A</h1><h2>B</h2><h3>C</h3></div>;"#),
            "heading-order"
        ));
    }

    #[test]
    fn heading_can_decrease_level() {
        // Jumping back to a lower level (h2 → h1) is fine per WCAG
        assert!(!has_rule(
            &scan(r#"const a = <div><h1>A</h1><h2>B</h2><h1>C</h1></div>;"#),
            "heading-order"
        ));
    }

    // --- missing-input-label ---

    #[test]
    fn detects_input_without_label() {
        assert!(has_rule(
            &scan(r#"const a = <input type="text" />;"#),
            "missing-input-label"
        ));
    }

    #[test]
    fn input_with_aria_label_is_ok() {
        assert!(!has_rule(
            &scan(r#"const a = <input type="text" aria-label="Email" />;"#),
            "missing-input-label"
        ));
    }

    #[test]
    fn input_with_id_is_ok() {
        assert!(!has_rule(
            &scan(r#"const a = <input type="text" id="email-field" />;"#),
            "missing-input-label"
        ));
    }

    // --- empty-link ---

    #[test]
    fn detects_empty_link() {
        assert!(has_rule(&scan(r#"const a = <a href="/home"></a>;"#), "empty-link"));
    }

    #[test]
    fn link_with_text_is_ok() {
        assert!(!has_rule(&scan(r#"const a = <a href="/home">Home</a>;"#), "empty-link"));
    }

    #[test]
    fn link_with_aria_label_is_ok() {
        assert!(!has_rule(
            &scan(r#"const a = <a href="/home" aria-label="Go home"></a>;"#),
            "empty-link"
        ));
    }

    // --- positive-tabindex ---

    #[test]
    fn detects_positive_tabindex() {
        assert!(has_rule(
            &scan(r#"const a = <div tabIndex={2}>x</div>;"#),
            "positive-tabindex"
        ));
    }

    #[test]
    fn tabindex_zero_is_ok() {
        assert!(!has_rule(
            &scan(r#"const a = <div tabIndex={0}>x</div>;"#),
            "positive-tabindex"
        ));
    }

    #[test]
    fn tabindex_minus_one_is_ok() {
        assert!(!has_rule(
            &scan(r#"const a = <div tabIndex={-1}>x</div>;"#),
            "positive-tabindex"
        ));
    }

    // --- clean component ---

    #[test]
    fn clean_component_has_no_violations() {
        let s = scan(
            r#"
            const Page = () => (
              <div>
                <h1>Welcome</h1>
                <h2>Section</h2>
                <img src="hero.png" alt="Hero image" />
                <a href="/about">About us</a>
                <input type="email" aria-label="Email address" />
                <Action>Sign up</Action>
              </div>
            );
            "#,
        );
        assert!(!s.has_violations(), "unexpected violations: {:?}", s.violations);
    }
}

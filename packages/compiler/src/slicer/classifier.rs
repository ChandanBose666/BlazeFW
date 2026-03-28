use std::collections::HashSet;
use swc_core::ecma::ast::*;
use swc_core::ecma::visit::{Visit, VisitWith};
use crate::scanner::CapabilityScanner;
use crate::secret_scanner::SecretScanner;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// The environment classification of a top-level declaration.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum DeclKind {
    /// Uses only server-side APIs — lives in the server bundle only.
    ServerOnly,
    /// Uses only browser APIs — lives in the client bundle only.
    ClientOnly,
    /// No environment-specific APIs — safe to include in both bundles.
    Shared,
    /// A server-side function called from client context.
    /// Kept in the server bundle; replaced with an RPC stub in the client bundle.
    BoundaryCrossing,
    /// Directly uses both client AND server APIs in the same body — compile error.
    Mixed,
}

/// A named top-level declaration with its environment classification.
#[derive(Debug, Clone)]
pub struct ClassifiedDecl {
    pub name: String,
    pub kind: DeclKind,
}

// ---------------------------------------------------------------------------
// Internal: reference collector
// ---------------------------------------------------------------------------

/// Visits an AST subtree and records every identifier name referenced.
struct ReferenceCollector {
    pub refs: HashSet<String>,
}

impl ReferenceCollector {
    fn new() -> Self {
        Self { refs: HashSet::new() }
    }
}

impl Visit for ReferenceCollector {
    fn visit_ident(&mut self, ident: &Ident) {
        self.refs.insert(ident.sym.as_ref().to_string());
    }
}

// ---------------------------------------------------------------------------
// Internal: name extraction helpers
// ---------------------------------------------------------------------------

fn decl_name(decl: &Decl) -> Option<String> {
    match decl {
        Decl::Fn(f) => Some(f.ident.sym.as_ref().to_string()),
        Decl::Class(c) => Some(c.ident.sym.as_ref().to_string()),
        Decl::Var(v) => v.decls.first().and_then(|d| {
            if let Pat::Ident(bi) = &d.name {
                Some(bi.id.sym.as_ref().to_string())
            } else {
                None
            }
        }),
        _ => None,
    }
}

pub fn module_item_name(item: &ModuleItem) -> Option<String> {
    match item {
        ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(e)) => decl_name(&e.decl),
        ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(e)) => match &e.decl {
            DefaultDecl::Fn(f) => f.ident.as_ref().map(|i| i.sym.as_ref().to_string()),
            DefaultDecl::Class(c) => c.ident.as_ref().map(|i| i.sym.as_ref().to_string()),
            _ => Some("default".to_string()),
        },
        ModuleItem::Stmt(Stmt::Decl(d)) => decl_name(d),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Internal: per-item classification
// ---------------------------------------------------------------------------

fn classify_item(item: &ModuleItem) -> DeclKind {
    let mut cap = CapabilityScanner::new();
    let mut sec = SecretScanner::new();
    item.visit_with(&mut cap);
    item.visit_with(&mut sec);

    match (cap.is_client(), sec.is_server_only()) {
        (true, false) => DeclKind::ClientOnly,
        (false, true) => DeclKind::ServerOnly,
        (true, true) => DeclKind::Mixed,
        (false, false) => DeclKind::Shared,
    }
}

fn collect_refs(item: &ModuleItem) -> HashSet<String> {
    let mut collector = ReferenceCollector::new();
    item.visit_with(&mut collector);
    collector.refs
}

// ---------------------------------------------------------------------------
// Public: Classifier
// ---------------------------------------------------------------------------

pub struct Classifier {
    pub declarations: Vec<ClassifiedDecl>,
}

impl Classifier {
    /// Two-pass classification of all named top-level declarations in a module.
    ///
    /// Pass 1 — direct trigger detection (ServerOnly / ClientOnly / Mixed / Shared).
    /// Pass 2 — cross-boundary reference detection → upgrades ServerOnly to BoundaryCrossing
    ///          when a client-side declaration calls the server function.
    pub fn classify(module: &Module) -> Self {
        // Pass 1
        let mut declarations: Vec<ClassifiedDecl> = module
            .body
            .iter()
            .filter_map(|item| {
                let name = module_item_name(item)?;
                let kind = classify_item(item);
                Some(ClassifiedDecl { name, kind })
            })
            .collect();

        // Pass 2 — detect BoundaryCrossing
        let server_names: HashSet<&str> = declarations
            .iter()
            .filter(|d| d.kind == DeclKind::ServerOnly)
            .map(|d| d.name.as_str())
            .collect();

        // Collect all refs from client-side or shared items
        let mut boundary: HashSet<String> = HashSet::new();
        for item in &module.body {
            let is_client_side = module_item_name(item)
                .and_then(|n| declarations.iter().find(|d| d.name == n))
                .map(|d| matches!(d.kind, DeclKind::ClientOnly | DeclKind::Shared))
                .unwrap_or(false);

            if is_client_side {
                for r in collect_refs(item) {
                    if server_names.contains(r.as_str()) {
                        boundary.insert(r);
                    }
                }
            }
        }

        // Upgrade ServerOnly → BoundaryCrossing
        for decl in &mut declarations {
            if boundary.contains(&decl.name) {
                decl.kind = DeclKind::BoundaryCrossing;
            }
        }

        Self { declarations }
    }

    pub fn names_of_kind(&self, kind: &DeclKind) -> HashSet<&str> {
        self.declarations
            .iter()
            .filter(|d| &d.kind == kind)
            .map(|d| d.name.as_str())
            .collect()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use swc_core::common::{FileName, SourceMap, sync::Lrc};
    use swc_core::ecma::parser::{lexer::Lexer, Parser, StringInput, Syntax};

    fn parse(src: &str) -> Module {
        let cm: Lrc<SourceMap> = Default::default();
        let fm = cm.new_source_file(FileName::Anon.into(), src.to_string());
        let lexer = Lexer::new(
            Syntax::Es(Default::default()),
            Default::default(),
            StringInput::from(&*fm),
            None,
        );
        Parser::new_from(lexer).parse_module().expect("parse failed")
    }

    fn kind_of(c: &Classifier, name: &str) -> Option<DeclKind> {
        c.declarations.iter().find(|d| d.name == name).map(|d| d.kind.clone())
    }

    #[test]
    fn classifies_server_only() {
        let m = parse("export function getUser() { return process.env.DB_URL; }");
        assert_eq!(kind_of(&Classifier::classify(&m), "getUser"), Some(DeclKind::ServerOnly));
    }

    #[test]
    fn classifies_client_only() {
        let m = parse("export function track() { window.analytics.track('view'); }");
        assert_eq!(kind_of(&Classifier::classify(&m), "track"), Some(DeclKind::ClientOnly));
    }

    #[test]
    fn classifies_shared() {
        let m = parse("export function add(a, b) { return a + b; }");
        assert_eq!(kind_of(&Classifier::classify(&m), "add"), Some(DeclKind::Shared));
    }

    #[test]
    fn classifies_mixed() {
        let m = parse("export function bad() { window.x = process.env.SECRET; }");
        assert_eq!(kind_of(&Classifier::classify(&m), "bad"), Some(DeclKind::Mixed));
    }

    #[test]
    fn detects_boundary_crossing() {
        let src = r#"
            export function getData() { return process.env.DB_URL; }
            export function UserCard() { window.loaded = true; getData(); }
        "#;
        let m = parse(src);
        let c = Classifier::classify(&m);
        assert_eq!(kind_of(&c, "getData"), Some(DeclKind::BoundaryCrossing));
        assert_eq!(kind_of(&c, "UserCard"), Some(DeclKind::ClientOnly));
    }
}

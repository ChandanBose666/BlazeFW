use std::collections::HashSet;
use std::path::Path;
use swc_core::common::{FileName, SourceMap, sync::Lrc, DUMMY_SP};
use swc_core::ecma::ast::*;
use swc_core::ecma::codegen::{Config, Emitter, text_writer::JsWriter};
use swc_core::ecma::parser::{lexer::Lexer, Parser, StringInput, Syntax};
use swc_core::ecma::visit::{VisitMut, VisitMutWith};
use super::classifier::{Classifier, DeclKind, module_item_name};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// The two output bundles produced by the Slicer.
#[derive(Debug)]
pub struct SliceResult {
    /// JavaScript for the server bundle — no browser APIs.
    pub server_js: String,
    /// JavaScript for the client bundle — no server secrets,
    /// BoundaryCrossing functions replaced with RPC stubs.
    pub client_js: String,
}

impl SliceResult {
    /// Write both outputs to `<dir>/module.server.js` and `<dir>/module.client.js`.
    pub fn write_to_dir(&self, dir: &Path) -> std::io::Result<()> {
        std::fs::create_dir_all(dir)?;
        std::fs::write(dir.join("module.server.js"), &self.server_js)?;
        std::fs::write(dir.join("module.client.js"), &self.client_js)?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Internal: VisitMut that replaces BoundaryCrossing fn bodies with RPC stubs
// ---------------------------------------------------------------------------

struct RpcStubber {
    boundary_names: HashSet<String>,
}

impl VisitMut for RpcStubber {
    fn visit_mut_fn_decl(&mut self, n: &mut FnDecl) {
        let name = n.ident.sym.as_ref().to_string();
        if self.boundary_names.contains(&name) {
            n.function.body = Some(build_rpc_stub_body(&name));
        }
        // Do NOT recurse — we only touch top-level fn decls
    }
}

/// Builds:
/// ```js
/// {
///   throw new Error("__nexus_rpc: 'name' is a server function. Initialize the Nexus runtime.");
/// }
/// ```
fn build_rpc_stub_body(name: &str) -> BlockStmt {
    let msg = format!(
        "__nexus_rpc: '{}' is a server function. Initialize the Nexus runtime.",
        name
    );

    let error_ident = Box::new(Expr::Ident(Ident::new("Error".into(), DUMMY_SP, Default::default())));

    let msg_arg = ExprOrSpread {
        spread: None,
        expr: Box::new(Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP,
            value: msg.into(),
            raw: None,
        }))),
    };

    let throw_expr = Expr::New(NewExpr {
        span: DUMMY_SP,
        callee: error_ident,
        args: Some(vec![msg_arg]),
        type_args: None,
        ctxt: Default::default(),
    });

    BlockStmt {
        span: DUMMY_SP,
        stmts: vec![Stmt::Throw(ThrowStmt {
            span: DUMMY_SP,
            arg: Box::new(throw_expr),
        })],
        ctxt: Default::default(),
    }
}

// ---------------------------------------------------------------------------
// Internal: codegen helper
// ---------------------------------------------------------------------------

fn emit_module(module: &Module, cm: Lrc<SourceMap>) -> String {
    let mut buf: Vec<u8> = Vec::new();
    {
        let wr = JsWriter::new(cm.clone(), "\n", &mut buf, None);
        let mut emitter = Emitter {
            cfg: Config::default(),
            cm: cm.clone(),
            comments: None,
            wr,
        };
        emitter.emit_module(module).expect("codegen failed");
    }
    String::from_utf8(buf).expect("invalid utf8 from codegen")
}

// ---------------------------------------------------------------------------
// Public: Transformer
// ---------------------------------------------------------------------------

pub struct Transformer;

impl Transformer {
    /// Parse `source`, classify all declarations, and return both output bundles.
    pub fn transform(source: &str) -> SliceResult {
        // Parse
        let cm: Lrc<SourceMap> = Default::default();
        let fm = cm.new_source_file(FileName::Anon.into(), source.to_string());
        let lexer = Lexer::new(
            Syntax::Es(Default::default()),
            Default::default(),
            StringInput::from(&*fm),
            None,
        );
        let module = Parser::new_from(lexer)
            .parse_module()
            .expect("failed to parse source");

        // Classify
        let classifier = Classifier::classify(&module);

        let client_only_names = classifier.names_of_kind(&DeclKind::ClientOnly);
        let server_only_names = classifier.names_of_kind(&DeclKind::ServerOnly);
        let boundary_names: HashSet<String> = classifier
            .names_of_kind(&DeclKind::BoundaryCrossing)
            .into_iter()
            .map(String::from)
            .collect();

        // --- Server module ---
        // Remove ClientOnly declarations; keep everything else.
        let mut server_module = module.clone();
        server_module.body.retain(|item| {
            module_item_name(item)
                .map(|n| !client_only_names.contains(n.as_str()))
                .unwrap_or(true)
        });
        let server_header = "// [nexus:server] Auto-generated server bundle.\n";
        let server_js = format!("{}{}", server_header, emit_module(&server_module, cm.clone()));

        // --- Client module ---
        // Remove ServerOnly declarations; replace BoundaryCrossing bodies with RPC stubs.
        let mut client_module = module.clone();
        client_module.body.retain(|item| {
            module_item_name(item)
                .map(|n| !server_only_names.contains(n.as_str()))
                .unwrap_or(true)
        });

        // Replace BoundaryCrossing function bodies
        let mut stubber = RpcStubber { boundary_names };
        client_module.visit_mut_with(&mut stubber);

        let client_header = "// [nexus:client] Auto-generated client bundle.\n";
        let client_js = format!("{}{}", client_header, emit_module(&client_module, cm));

        SliceResult { server_js, client_js }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    const MIXED_SOURCE: &str = r#"
import { db } from './db';

export async function getUser(id) {
    return process.env.DB_URL;
}

export function add(a, b) {
    return a + b;
}

export function UserCard() {
    window.loaded = true;
    return getUser('123');
}
"#;

    #[test]
    fn server_bundle_excludes_client_code() {
        let result = Transformer::transform(MIXED_SOURCE);
        assert!(!result.server_js.contains("window"), "server bundle must not contain window");
        assert!(result.server_js.contains("getUser"), "server bundle must contain getUser");
        assert!(result.server_js.contains("add"), "server bundle must contain shared fn");
    }

    #[test]
    fn client_bundle_excludes_server_secrets() {
        let result = Transformer::transform(MIXED_SOURCE);
        assert!(
            !result.client_js.contains("process.env"),
            "client bundle must not contain process.env"
        );
        assert!(result.client_js.contains("UserCard"), "client bundle must contain UserCard");
        assert!(result.client_js.contains("add"), "client bundle must contain shared fn");
    }

    #[test]
    fn boundary_crossing_fn_replaced_with_stub() {
        let result = Transformer::transform(MIXED_SOURCE);
        // getUser is BoundaryCrossing — client bundle should have the RPC stub, not process.env
        assert!(
            result.client_js.contains("__nexus_rpc"),
            "client bundle must contain RPC stub marker"
        );
        assert!(
            !result.client_js.contains("process.env"),
            "client RPC stub must not expose process.env"
        );
    }

    #[test]
    fn server_bundle_header_present() {
        let result = Transformer::transform(MIXED_SOURCE);
        assert!(result.server_js.starts_with("// [nexus:server]"));
        assert!(result.client_js.starts_with("// [nexus:client]"));
    }
}

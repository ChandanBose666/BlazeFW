use std::collections::HashSet;
use std::path::Path;
use swc_core::common::{FileName, SourceMap, sync::Lrc, DUMMY_SP};
use swc_core::ecma::ast::*;
use swc_core::ecma::codegen::{Config, Emitter, text_writer::JsWriter};
use swc_core::ecma::parser::{lexer::Lexer, Parser, StringInput, Syntax, TsSyntax};
use swc_core::ecma::visit::{VisitMut, VisitMutWith};
use super::classifier::{Classifier, DeclKind, module_item_name};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// Error returned by [`Transformer::transform`] when the source cannot be
/// processed. Surfaced as a JS exception (WASM) or stderr + non-zero exit
/// (CLI) — never a panic, so a malformed `.blazefw.tsx` file produces a
/// diagnostic instead of crashing the build.
#[derive(Debug)]
pub struct TransformError {
    pub message: String,
}

impl std::fmt::Display for TransformError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for TransformError {}

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
///   throw new Error("__blazefw_rpc: 'name' is a server function. Initialize the BlazeFW runtime.");
/// }
/// ```
fn build_rpc_stub_body(name: &str) -> BlockStmt {
    let msg = format!(
        "__blazefw_rpc: '{}' is a server function. Initialize the BlazeFW runtime.",
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
    ///
    /// `source` is parsed as TypeScript + JSX (`.tsx`) since `.blazefw.tsx`
    /// files are React components. `.blazefw.ts` files are also parsed in TSX
    /// mode, so old-style `<T>x` type assertions must be written `x as T`.
    pub fn transform(source: &str) -> Result<SliceResult, TransformError> {
        // Parse — TSX so JSX elements and TypeScript syntax are both accepted.
        let cm: Lrc<SourceMap> = Default::default();
        let fm = cm.new_source_file(FileName::Anon.into(), source.to_string());
        let lexer = Lexer::new(
            Syntax::Typescript(TsSyntax {
                tsx: true,
                ..Default::default()
            }),
            Default::default(),
            StringInput::from(&*fm),
            None,
        );
        let module = Parser::new_from(lexer)
            .parse_module()
            .map_err(|e| TransformError {
                message: format!("failed to parse source: {:?}", e),
            })?;

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
        let server_header = "// [blazefw:server] Auto-generated server bundle.\n";
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

        let client_header = "// [blazefw:client] Auto-generated client bundle.\n";
        let client_js = format!("{}{}", client_header, emit_module(&client_module, cm));

        Ok(SliceResult { server_js, client_js })
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Convenience: transform and unwrap, failing the test with the parser
    /// message if the source is invalid.
    fn slice(source: &str) -> SliceResult {
        Transformer::transform(source).expect("transform should succeed")
    }

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
        let result = slice(MIXED_SOURCE);
        assert!(!result.server_js.contains("window"), "server bundle must not contain window");
        assert!(result.server_js.contains("getUser"), "server bundle must contain getUser");
        assert!(result.server_js.contains("add"), "server bundle must contain shared fn");
    }

    #[test]
    fn client_bundle_excludes_server_secrets() {
        let result = slice(MIXED_SOURCE);
        assert!(
            !result.client_js.contains("process.env"),
            "client bundle must not contain process.env"
        );
        assert!(result.client_js.contains("UserCard"), "client bundle must contain UserCard");
        assert!(result.client_js.contains("add"), "client bundle must contain shared fn");
    }

    #[test]
    fn boundary_crossing_fn_replaced_with_stub() {
        let result = slice(MIXED_SOURCE);
        // getUser is BoundaryCrossing — client bundle should have the RPC stub, not process.env
        assert!(
            result.client_js.contains("__blazefw_rpc"),
            "client bundle must contain RPC stub marker"
        );
        assert!(
            !result.client_js.contains("process.env"),
            "client RPC stub must not expose process.env"
        );
    }

    #[test]
    fn server_bundle_header_present() {
        let result = slice(MIXED_SOURCE);
        assert!(result.server_js.starts_with("// [blazefw:server]"));
        assert!(result.client_js.starts_with("// [blazefw:client]"));
    }

    // --- JSX / TSX support (the .blazefw.tsx case) ----------------------

    const JSX_COMPONENT: &str = r#"
import { useState } from 'react';
import { Stack, Text, Action } from '@blazefw/web';

export function Counter() {
    const [count, setCount] = useState(0);
    return (
        <Stack direction="column" gap={4}>
            <Text variant="display">{count}</Text>
            <Action variant="primary" onPress={() => setCount((c) => c + 1)}>+ 1</Action>
        </Stack>
    );
}
"#;

    #[test]
    fn parses_and_slices_a_jsx_component() {
        let result = slice(JSX_COMPONENT);
        assert!(result.client_js.contains("Counter"), "client bundle must contain the component");
        assert!(result.client_js.contains("Stack"), "client bundle must keep the JSX");
        assert!(result.server_js.contains("Counter"), "server bundle keeps the shared component");
    }

    const TSX_TYPES: &str = r#"
import { useState } from 'react';

interface Props { label: string; count?: number }

export function Badge({ label, count = 0 }: Props): JSX.Element {
    const [n, setN] = useState<number>(count);
    return <span aria-label={label}>{label}: {n}</span>;
}
"#;

    #[test]
    fn parses_typescript_syntax_with_jsx() {
        // Type annotations, an interface, and a generic call must not trip the parser.
        let result = slice(TSX_TYPES);
        assert!(result.client_js.contains("Badge"));
    }

    const JSX_BOUNDARY: &str = r#"
import { useState } from 'react';

export async function saveDraft(text) {
    return process.env.DRAFTS_URL + '/' + text;
}

export function Editor() {
    const [text, setText] = useState('');
    return <button onClick={() => saveDraft(text)}>{text}</button>;
}
"#;

    #[test]
    fn boundary_crossing_works_through_jsx() {
        let result = slice(JSX_BOUNDARY);
        // saveDraft uses a server secret and is called from a client component → RPC stub on the client.
        assert!(result.client_js.contains("__blazefw_rpc"), "client must get an RPC stub for saveDraft");
        assert!(!result.client_js.contains("process.env"), "client must not leak the server secret");
        assert!(result.server_js.contains("process.env"), "server keeps the real implementation");
        assert!(result.client_js.contains("Editor"), "client keeps the component");
    }

    // --- Error handling: malformed input must not panic ------------------

    #[test]
    fn malformed_source_returns_err_not_panic() {
        let err = Transformer::transform("export function ( { { {")
            .expect_err("malformed source must be an Err");
        assert!(err.to_string().contains("failed to parse source"), "got: {err}");
    }

    #[test]
    fn unterminated_jsx_returns_err_not_panic() {
        let err = Transformer::transform("export function Broken() { return <div>oops; }")
            .expect_err("unterminated JSX must be an Err");
        assert!(err.to_string().contains("failed to parse source"), "got: {err}");
    }
}

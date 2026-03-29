use automerge::{
    transaction::Transactable, AutoCommit, ObjType, ReadDoc, ScalarValue, ScalarValueRef, Value,
    ValueRef,
};
use wasm_bindgen::prelude::*;

/// A CRDT document backed by Automerge.
///
/// All methods are exposed to JavaScript/TypeScript via wasm-bindgen.
/// The document is a flat key-value map at its root — suitable for
/// syncing simple component state across peers.
#[wasm_bindgen]
pub struct CrdtDoc {
    inner: AutoCommit,
}

#[wasm_bindgen]
impl CrdtDoc {
    /// Create a new, empty CRDT document.
    #[wasm_bindgen(constructor)]
    pub fn new() -> CrdtDoc {
        CrdtDoc {
            inner: AutoCommit::new(),
        }
    }

    /// Read a string value at `key` from the root map.
    ///
    /// Returns `undefined` (JS) when the key does not exist or the value is
    /// not a scalar that can be represented as a string.
    pub fn get(&self, key: &str) -> Option<String> {
        match self.inner.get(automerge::ROOT, key) {
            Ok(Some((Value::Scalar(scalar), _))) => match scalar.as_ref() {
                ScalarValue::Str(s) => Some(s.to_string()),
                ScalarValue::Int(n) => Some(n.to_string()),
                ScalarValue::Uint(n) => Some(n.to_string()),
                ScalarValue::F64(n) => Some(n.to_string()),
                ScalarValue::Boolean(b) => Some(b.to_string()),
                ScalarValue::Null => None,
                _ => None,
            },
            _ => None,
        }
    }

    /// Read the value at `key` and return it as a JSON string.
    ///
    /// Scalar values are returned as JSON primitives.
    /// Map/List objects are returned as serialised JSON.
    /// Returns `null` when the key does not exist.
    pub fn get_json(&self, key: &str) -> String {
        match self.inner.get(automerge::ROOT, key) {
            Ok(Some((value, obj_id))) => match value {
                Value::Scalar(scalar) => scalar_to_json(scalar.as_ref()),
                Value::Object(ObjType::Map) => {
                    let pairs: Vec<String> = self
                        .inner
                        .map_range(&obj_id, ..)
                        .map(|item| {
                            format!(
                                "\"{}\":{}",
                                item.key,
                                match item.value {
                                    ValueRef::Scalar(s) => scalar_ref_to_json(s),
                                    _ => "null".to_string(),
                                }
                            )
                        })
                        .collect();
                    format!("{{{}}}", pairs.join(","))
                }
                Value::Object(ObjType::List) => {
                    let items: Vec<String> = self
                        .inner
                        .list_range(&obj_id, ..)
                        .map(|item| match item.value {
                            ValueRef::Scalar(s) => scalar_ref_to_json(s),
                            _ => "null".to_string(),
                        })
                        .collect();
                    format!("[{}]", items.join(","))
                }
                _ => "null".to_string(),
            },
            _ => "null".to_string(),
        }
    }

    /// Set a string value at `key` in the root map.
    ///
    /// Silently does nothing when the transaction fails (shouldn't happen
    /// for a local set on a valid document).
    pub fn set(&mut self, key: &str, value: &str) {
        let _ = self.inner.put(automerge::ROOT, key, value);
    }

    /// Set a numeric (f64) value at `key` in the root map.
    pub fn set_number(&mut self, key: &str, value: f64) {
        let _ = self.inner.put(automerge::ROOT, key, value);
    }

    /// Set a boolean value at `key` in the root map.
    pub fn set_bool(&mut self, key: &str, value: bool) {
        let _ = self.inner.put(automerge::ROOT, key, value);
    }

    /// Delete `key` from the root map.
    pub fn delete(&mut self, key: &str) {
        let _ = self.inner.delete(automerge::ROOT, key);
    }

    /// Serialise the full document to a byte array (Automerge binary format).
    ///
    /// Pass the result to `load()` or `merge()` on another peer.
    pub fn save(&mut self) -> Vec<u8> {
        self.inner.save()
    }

    /// Replace this document's state by loading from raw bytes.
    ///
    /// Throws a JS error if the bytes are not a valid Automerge document.
    pub fn load(data: &[u8]) -> Result<CrdtDoc, JsValue> {
        let inner = AutoCommit::load(data)
            .map_err(|e| JsValue::from_str(&format!("CrdtDoc.load failed: {e}")))?;
        Ok(CrdtDoc { inner })
    }

    /// Merge a remote document (raw bytes) into this one.
    ///
    /// Applies CRDT merge semantics — concurrent writes are resolved
    /// deterministically; no data is lost.
    ///
    /// Throws a JS error if the bytes are not a valid Automerge document.
    pub fn merge(&mut self, data: &[u8]) -> Result<(), JsValue> {
        let mut remote = AutoCommit::load(data)
            .map_err(|e| JsValue::from_str(&format!("CrdtDoc.merge: load failed: {e}")))?;
        self.inner
            .merge(&mut remote)
            .map_err(|e| JsValue::from_str(&format!("CrdtDoc.merge: merge failed: {e}")))?;
        Ok(())
    }

    /// Return all root-level keys as a JSON array string.
    pub fn keys(&self) -> String {
        let keys: Vec<String> = self
            .inner
            .keys(automerge::ROOT)
            .map(|k| format!("\"{}\"", k))
            .collect();
        format!("[{}]", keys.join(","))
    }
}

/// Render an owned scalar value as a JSON literal.
fn scalar_to_json(scalar: &ScalarValue) -> String {
    match scalar {
        ScalarValue::Str(s) => format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\"")),
        ScalarValue::Int(n) => n.to_string(),
        ScalarValue::Uint(n) => n.to_string(),
        ScalarValue::F64(n) => n.to_string(),
        ScalarValue::Boolean(b) => b.to_string(),
        ScalarValue::Null => "null".to_string(),
        _ => "null".to_string(),
    }
}

/// Render a borrowed scalar value (from range iterators) as a JSON literal.
fn scalar_ref_to_json(scalar: ScalarValueRef<'_>) -> String {
    match scalar {
        ScalarValueRef::Str(s) => {
            format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
        }
        ScalarValueRef::Int(n) => n.to_string(),
        ScalarValueRef::Uint(n) => n.to_string(),
        ScalarValueRef::F64(n) => n.to_string(),
        ScalarValueRef::Boolean(b) => b.to_string(),
        ScalarValueRef::Null => "null".to_string(),
        _ => "null".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_doc_is_empty() {
        let doc = CrdtDoc::new();
        assert_eq!(doc.keys(), "[]");
    }

    #[test]
    fn test_set_and_get_string() {
        let mut doc = CrdtDoc::new();
        doc.set("name", "Alice");
        assert_eq!(doc.get("name"), Some("Alice".to_string()));
    }

    #[test]
    fn test_set_and_get_number() {
        let mut doc = CrdtDoc::new();
        doc.set_number("count", 42.0);
        assert_eq!(doc.get("count"), Some("42".to_string()));
    }

    #[test]
    fn test_set_and_get_bool() {
        let mut doc = CrdtDoc::new();
        doc.set_bool("active", true);
        assert_eq!(doc.get("active"), Some("true".to_string()));
    }

    #[test]
    fn test_delete_key() {
        let mut doc = CrdtDoc::new();
        doc.set("foo", "bar");
        doc.delete("foo");
        assert_eq!(doc.get("foo"), None);
    }

    #[test]
    fn test_get_missing_key_returns_none() {
        let doc = CrdtDoc::new();
        assert_eq!(doc.get("missing"), None);
    }

    #[test]
    fn test_save_and_load_roundtrip() {
        let mut doc = CrdtDoc::new();
        doc.set("title", "UltimateJs");
        doc.set_number("version", 1.0);

        let bytes = doc.save();
        let loaded = CrdtDoc::load(&bytes).expect("load failed");
        assert_eq!(loaded.get("title"), Some("UltimateJs".to_string()));
        assert_eq!(loaded.get("version"), Some("1".to_string()));
    }

    #[test]
    fn test_merge_two_independent_docs() {
        // Peer A sets "x"
        let mut peer_a = CrdtDoc::new();
        peer_a.set("x", "from-a");

        // Peer B sets "y"
        let mut peer_b = CrdtDoc::new();
        peer_b.set("y", "from-b");

        // Merge B's state into A
        let b_bytes = peer_b.save();
        peer_a.merge(&b_bytes).expect("merge failed");

        // A should now see both keys
        assert_eq!(peer_a.get("x"), Some("from-a".to_string()));
        assert_eq!(peer_a.get("y"), Some("from-b".to_string()));
    }

    #[test]
    fn test_merge_last_write_wins_for_concurrent_sets() {
        // Peer A and B both start from the same empty doc
        let mut peer_a = CrdtDoc::new();
        let mut peer_b = CrdtDoc::load(&peer_a.save()).unwrap();

        // Both write to the same key concurrently
        peer_a.set("status", "online");
        peer_b.set("status", "offline");

        // Merge B into A — Automerge resolves deterministically
        let b_bytes = peer_b.save();
        peer_a.merge(&b_bytes).expect("merge failed");

        // The key must exist (either value is valid — CRDT resolved it)
        assert!(peer_a.get("status").is_some());
    }

    #[test]
    fn test_keys_lists_all_root_keys() {
        let mut doc = CrdtDoc::new();
        doc.set("a", "1");
        doc.set("b", "2");
        doc.set("c", "3");

        let keys_json = doc.keys();
        assert!(keys_json.contains("\"a\""));
        assert!(keys_json.contains("\"b\""));
        assert!(keys_json.contains("\"c\""));
    }

    #[test]
    fn test_get_json_string() {
        let mut doc = CrdtDoc::new();
        doc.set("greeting", "hello");
        assert_eq!(doc.get_json("greeting"), "\"hello\"");
    }

    #[test]
    fn test_get_json_missing_returns_null() {
        let doc = CrdtDoc::new();
        assert_eq!(doc.get_json("nope"), "null");
    }
}

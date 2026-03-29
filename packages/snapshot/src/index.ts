// Error Boundary
export { SnapshotBoundary } from './snapshot-boundary.js';
export type { SnapshotBoundaryProps, RestoreMeta } from './snapshot-boundary.js';

// Ring buffer (useful for custom integrations)
export { SnapshotBuffer } from './snapshot-buffer.js';
export type { Snapshot } from './snapshot-buffer.js';

// Convenience hook
export { useSnapshot } from './use-snapshot.js';
export type { UseSnapshotOptions, UseSnapshotResult } from './use-snapshot.js';

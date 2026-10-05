export type IngestErrorKind =
  | 'empty-file'
  | 'not-gzip'
  | 'wrong-file'
  | 'truncated'
  | 'empty-map'
  | 'too-many-colors'
  | 'aborted'
  | 'unsupported-browser'
  | 'read-failed';

/** Typed, user-presentable load errors. Messages are looked up by `kind` in the locale files. */
export class IngestError extends Error {
  readonly kind: IngestErrorKind;
  readonly hint?: 'world' | 'unknown';

  constructor(kind: IngestErrorKind, hint?: 'world' | 'unknown') {
    super(kind);
    this.kind = kind;
    this.hint = hint;
    this.name = 'IngestError';
  }
}

export interface IngestWarning {
  kind: 'corrupt-part';
  cx: number;
  cy: number;
  reason: string;
}

export interface SerializedIngestError {
  kind: IngestErrorKind;
  hint?: 'world' | 'unknown';
}

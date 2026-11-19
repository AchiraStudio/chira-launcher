import type { ErrorCode } from './bindings/ErrorCode';
import type { ProtocolError } from './bindings/ProtocolError';

/** A failed engine call, normalised from whatever the transport threw. */
export class EngineCallError extends Error {
  readonly code: ErrorCode | 'transport';

  constructor(code: ErrorCode | 'transport', message: string) {
    super(message);
    this.name = 'EngineCallError';
    this.code = code;
  }
}

function isProtocolError(value: unknown): value is ProtocolError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ProtocolError).code === 'string' &&
    typeof (value as ProtocolError).message === 'string'
  );
}

/** Tauri rejects with the serialized `ProtocolError` for failed commands, or a string for IPC faults. */
export function toEngineCallError(thrown: unknown): EngineCallError {
  if (thrown instanceof EngineCallError) return thrown;
  if (isProtocolError(thrown)) return new EngineCallError(thrown.code, thrown.message);
  if (thrown instanceof Error) return new EngineCallError('transport', thrown.message);
  if (typeof thrown === 'string') return new EngineCallError('transport', thrown);
  return new EngineCallError('transport', 'Unknown error while talking to the engine.');
}

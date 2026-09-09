import { randomUUID } from 'crypto'

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function normalizeSessionId(sessionId?: string): string {
  return sessionId && SESSION_ID_PATTERN.test(sessionId) ? sessionId : randomUUID()
}

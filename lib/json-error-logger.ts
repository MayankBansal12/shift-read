import fs from 'node:fs'
import path from 'node:path'

const LOGS_DIR = path.join(process.cwd(), 'logs')

function getLogFilePath(): string {
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return path.join(LOGS_DIR, `json-error-${date}.log`)
}

export function logJsonParseError(
  context: string,
  rawResponse: string,
  error: unknown
): void {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true })
    }

    const logEntry = [
      `=== JSON Parse Error ===`,
      `Timestamp: ${new Date().toISOString()}`,
      `Context: ${context}`,
      `Error: ${error instanceof Error ? error.message : String(error)}`,
      `Stack: ${error instanceof Error ? error.stack : 'N/A'}`,
      ``,
      `=== Raw Response (first 5000 chars) ===`,
      rawResponse.slice(0, 5000),
      rawResponse.length > 5000 ? `... (${rawResponse.length - 5000} more chars)` : '',
      ``,
      `=== Full Raw Response (last 2000 chars) ===`,
      rawResponse.length > 2000 ? `... ${rawResponse.slice(-2000)}` : rawResponse,
      ``,
      `====================================`,
      ``,
    ].join('\n')

    fs.appendFileSync(getLogFilePath(), logEntry, 'utf-8')
    console.log(`[json-error-logger] Error logged to ${getLogFilePath()}`)
  } catch (fsError) {
    console.error('[json-error-logger] Failed to write log file:', fsError)
  }
}

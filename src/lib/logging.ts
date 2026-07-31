/**
 * Minimal structured JSON logger.
 *
 * One JSON object per line so Cloud Logging parses it automatically. The
 * `severity` field maps to Cloud Logging severities. A correlation id can be
 * threaded through the `meta` object per request in later phases.
 */
type Level = "DEBUG" | "INFO" | "WARNING" | "ERROR";

type Meta = Record<string, unknown>;

function emit(severity: Level, message: string, meta?: Meta) {
  const entry = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const line = JSON.stringify(entry);
  if (severity === "ERROR") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (severity === "WARNING") {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, meta?: Meta) => emit("DEBUG", message, meta),
  info: (message: string, meta?: Meta) => emit("INFO", message, meta),
  warn: (message: string, meta?: Meta) => emit("WARNING", message, meta),
  error: (message: string, meta?: Meta) => emit("ERROR", message, meta),
};

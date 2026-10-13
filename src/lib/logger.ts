type Fields = Record<string, string | number | boolean | null | undefined>;

export function logEvent(level: "info" | "error", event: string, fields: Fields = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === "error") console.error(line);
  else console.log(line);
}

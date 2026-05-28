export function isJwtSessionError(error: unknown) {
  const seen = new Set<unknown>();
  const queue: unknown[] = [error];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || seen.has(current)) {
      continue;
    }

    seen.add(current);

    if (typeof current === "string") {
      if (isJwtSessionErrorMessage(current)) {
        return true;
      }

      continue;
    }

    if (typeof current !== "object") {
      continue;
    }

    const record = current as Record<string, unknown>;
    const message = [
      record.name,
      record.type,
      record.code,
      record.message,
      record.stack,
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" ");

    if (isJwtSessionErrorMessage(message)) {
      return true;
    }

    queue.push(record.cause);

    if (record.cause && typeof record.cause === "object") {
      const causeRecord = record.cause as Record<string, unknown>;

      queue.push(causeRecord.err);
      queue.push(causeRecord.cause);
    }
  }

  return false;
}

function isJwtSessionErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("jwtsessionerror") ||
    normalized.includes("jwt session error") ||
    normalized.includes("no matching decryption secret") ||
    normalized.includes("jwt_session_error")
  );
}


export function sanitizeForFirestore<T>(value: T): T {
  return sanitizeValue(value, false) as T;
}

function sanitizeValue(value: unknown, insideArray: boolean): unknown {
  if (value === undefined) {
    return insideArray ? null : undefined;
  }

  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, true));
  }

  if (typeof value !== "object") {
    return value;
  }

  if (isNativePassthrough(value) || !isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, sanitizeValue(item, false)] as const)
      .filter(([, item]) => item !== undefined)
  );
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNativePassthrough(value: object): boolean {
  return value instanceof Date
    || (typeof File !== "undefined" && value instanceof File)
    || (typeof Blob !== "undefined" && value instanceof Blob);
}

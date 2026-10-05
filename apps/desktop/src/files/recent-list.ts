const LIMIT = 10;

export function pushRecent(
  list: readonly string[],
  path: string,
  limit = LIMIT,
): readonly string[] {
  return [path, ...list.filter((p) => p !== path)].slice(0, limit);
}

export function withoutRecent(list: readonly string[], path: string): readonly string[] {
  return list.filter((p) => p !== path);
}

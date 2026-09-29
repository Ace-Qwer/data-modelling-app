import { readFileSync } from 'node:fs';

// The Tauri config is the single source of the version shipped to users.
export function readAppVersion(): string {
  const config = JSON.parse(
    readFileSync(new URL('./src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
  ) as { version: string };
  return config.version;
}

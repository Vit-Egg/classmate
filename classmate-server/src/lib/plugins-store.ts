/** Pluginy a vložené weby uživatele na serveru (tabulka user_plugins). Vidí je jen on, na všech jeho zařízeních. */
import { get, run } from "./db";
import { EMPTY_STATE, MAX_STATE_BYTES, sanitizeState, type PluginState } from "./plugins-core";

export function getPluginState(userId: number): PluginState {
  const row = get<{ json: string }>("SELECT json FROM user_plugins WHERE user_id = ?", userId);
  if (!row) return EMPTY_STATE;
  try {
    return sanitizeState(JSON.parse(row.json));
  } catch {
    return EMPTY_STATE;
  }
}

export function savePluginState(userId: number, raw: string) {
  if (raw.length > MAX_STATE_BYTES) throw new Error("too large");
  const state = sanitizeState(JSON.parse(raw));
  run("INSERT INTO user_plugins (user_id, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at", userId, JSON.stringify(state), Date.now());
}

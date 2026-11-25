"use client";

import { useEffect } from "react";
import { initPlugins, migrateLegacy } from "@/lib/plugins-client";
import type { PluginState } from "@/lib/plugins-core";

/** Předá stav pluginů ze serveru do prohlížeče (hned při vykreslení, dřív než ho čtou menu a Dnes) a převezme starší pluginy z localStorage. */
export function PluginsBoot({ state, userId }: { state: PluginState; userId: number }) {
  if (typeof window !== "undefined") initPlugins(state, userId);
  useEffect(() => migrateLegacy(), []);
  return null;
}

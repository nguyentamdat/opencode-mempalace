import type { UpdateResult } from "../auto-update.js";

export interface UpdateContext {
  updateResult: UpdateResult | null;
  PLUGIN_VERSION: string;
}

export function createUpdateNotification(context: UpdateContext): string | null {
  const { updateResult, PLUGIN_VERSION } = context;
  
  if (updateResult?.updated) {
    return `[opencode-mempalace] Updated ${updateResult.currentVersion} → ${updateResult.latestVersion}. Restart OpenCode to apply.`;
  }
  
  return null;
}

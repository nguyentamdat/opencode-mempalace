import fs from "node:fs";

import path from "node:path";

/**
 * Derive a mempalace "wing" name from a workspace path.
 *
 * Takes the directory basename, lowercases it, and replaces non-alphanumeric
 * characters with hyphens. Empty/root paths fall back to `wing_general`.
 *
 * Examples:
 *   /home/dat/opencode-mempalace  ->  wing_opencode-mempalace
 *   /home/dat/My Project          ->  wing_my-project
 *   /                             ->  wing_general
 *
 * Ported from option-K/opencode-plugin-mempalace src/utils.ts.
 */
export function getWingFromPath(workspacePath: string): string {
  if (!workspacePath || workspacePath === "/") {
    return "wing_general";
  }
  const baseName = path.basename(workspacePath);
  const sanitized = baseName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  if (!sanitized || sanitized === "-") {
    return "wing_general";
  }
  return `wing_${sanitized}`;
}

/**
 * Check if a workspace directory is effectively empty.
 * Ignores common metadata directories and hidden files.
 *
 * @param dir - Directory path to check
 * @returns true if empty or only contains ignored files
 *
 * Ported from option-K/opencode-plugin-mempalace src/utils.ts.
 */
export function isEmptyWorkspace(dir: string): boolean {
  try {
    const files = fs.readdirSync(dir);
    const ignored = new Set([
      ".git",
      ".mempalace",
      ".opencode",
      ".DS_Store",
      "node_modules",
      ".cursor",
      ".vscode",
      ".idea",
      ".claude",
      ".gitnexus",
    ]);
    const meaningfulFiles = files.filter((f) => !ignored.has(f));
    return meaningfulFiles.length === 0;
  } catch {
    return true;
  }
}

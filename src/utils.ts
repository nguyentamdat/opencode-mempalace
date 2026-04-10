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

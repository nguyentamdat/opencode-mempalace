import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

const PACKAGE_NAME = "opencode-mempalace";
const NPM_REGISTRY_URL = `https://registry.npmjs.org/-/package/${PACKAGE_NAME}/dist-tags`;
const NPM_FETCH_TIMEOUT = 5000;

// --- Path helpers (mirrors oh-my-openagent conventions) ---

function getOpenCodeCacheDir(): string {
  if (process.platform === "win32") {
    const appdata =
      process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appdata, "opencode");
  }
  return path.join(
    process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"),
    "opencode",
  );
}

function getOpenCodeConfigDir(): string {
  if (process.platform === "win32") {
    const appdata =
      process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appdata, "opencode");
  }
  return path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"),
    "opencode",
  );
}

const CACHE_DIR = path.join(getOpenCodeCacheDir(), "packages");
const CONFIG_DIR = getOpenCodeConfigDir();

// --- Version detection ---

function getCachedVersion(): string | null {
  const locations = [
    path.join(CACHE_DIR, "node_modules", PACKAGE_NAME, "package.json"),
    path.join(
      CACHE_DIR,
      `${PACKAGE_NAME}@latest`,
      "node_modules",
      PACKAGE_NAME,
      "package.json",
    ),
    path.join(CONFIG_DIR, "node_modules", PACKAGE_NAME, "package.json"),
  ];

  for (const pkgPath of locations) {
    try {
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.version) return pkg.version;
      }
    } catch {}
  }
  return null;
}

async function getLatestVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NPM_FETCH_TIMEOUT);
  try {
    const response = await fetch(NPM_REGISTRY_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, string>;
    return data.latest ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Cache invalidation (mirrors oh-my-openagent pattern) ---

function stripTrailingCommas(json: string): string {
  return json.replace(/,(\s*[}\]])/g, "$1");
}

function invalidatePackage(): boolean {
  const pkgDirs = [
    path.join(CONFIG_DIR, "node_modules", PACKAGE_NAME),
    path.join(CACHE_DIR, "node_modules", PACKAGE_NAME),
    path.join(
      CACHE_DIR,
      `${PACKAGE_NAME}@latest`,
      "node_modules",
      PACKAGE_NAME,
    ),
  ];

  let removed = false;
  for (const dir of pkgDirs) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        removed = true;
      }
    } catch {}
  }

  // Remove from bun lockfiles to force re-resolution
  for (const baseDir of [CACHE_DIR, path.join(CACHE_DIR, `${PACKAGE_NAME}@latest`)]) {
    const textLock = path.join(baseDir, "bun.lock");
    const binaryLock = path.join(baseDir, "bun.lockb");

    if (fs.existsSync(textLock)) {
      try {
        const content = fs.readFileSync(textLock, "utf-8");
        const lock = JSON.parse(stripTrailingCommas(content));
        if (lock.packages?.[PACKAGE_NAME]) {
          delete lock.packages[PACKAGE_NAME];
          fs.writeFileSync(textLock, JSON.stringify(lock, null, 2));
          removed = true;
        }
      } catch {}
    } else if (fs.existsSync(binaryLock)) {
      try {
        fs.unlinkSync(binaryLock);
        removed = true;
      } catch {}
    }
  }

  return removed;
}

function syncCachePackageJson(pkgJsonPath: string): boolean {
  try {
    if (!fs.existsSync(pkgJsonPath)) {
      fs.mkdirSync(path.dirname(pkgJsonPath), { recursive: true });
      fs.writeFileSync(
        pkgJsonPath,
        JSON.stringify(
          { dependencies: { [PACKAGE_NAME]: "latest" } },
          null,
          2,
        ),
      );
      return true;
    }

    const content = fs.readFileSync(pkgJsonPath, "utf-8");
    const pkg = JSON.parse(content);
    if (!pkg.dependencies) pkg.dependencies = {};
    if (pkg.dependencies[PACKAGE_NAME] === "latest") return true;

    pkg.dependencies[PACKAGE_NAME] = "latest";

    // Atomic write
    const tmpPath = `${pkgJsonPath}.${crypto.randomUUID()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(pkg, null, 2));
    fs.renameSync(tmpPath, pkgJsonPath);
    return true;
  } catch {
    return false;
  }
}

function resolveActiveWorkspace(): string {
  const configInstall = path.join(
    CONFIG_DIR,
    "node_modules",
    PACKAGE_NAME,
    "package.json",
  );
  const cacheInstall = path.join(
    CACHE_DIR,
    "node_modules",
    PACKAGE_NAME,
    "package.json",
  );

  if (fs.existsSync(configInstall)) return CONFIG_DIR;
  if (fs.existsSync(cacheInstall)) return CACHE_DIR;
  if (fs.existsSync(path.join(CACHE_DIR, "package.json"))) return CACHE_DIR;
  return CONFIG_DIR;
}

// --- Public API ---

export interface UpdateResult {
  currentVersion: string | null;
  latestVersion: string | null;
  updated: boolean;
  error?: string;
}

/**
 * Check npm registry for a newer version and install it if available.
 * @param runInstall - Callback to run `bun install` in a given directory. Returns true on success.
 */
export async function checkAndUpdate(
  runInstall: (cwd: string) => Promise<boolean>,
): Promise<UpdateResult> {
  const currentVersion = getCachedVersion();
  const latestVersion = await getLatestVersion();

  if (!currentVersion || !latestVersion) {
    return { currentVersion, latestVersion, updated: false };
  }

  if (currentVersion === latestVersion) {
    return { currentVersion, latestVersion, updated: false };
  }

  try {
    // Sync both workspaces' package.json to request "latest"
    syncCachePackageJson(path.join(CACHE_DIR, "package.json"));
    const atLatestDir = path.join(CACHE_DIR, `${PACKAGE_NAME}@latest`);
    if (fs.existsSync(atLatestDir)) {
      syncCachePackageJson(path.join(atLatestDir, "package.json"));
    }

    invalidatePackage();

    // Install in the active workspace
    const activeWorkspace = resolveActiveWorkspace();
    const success = await runInstall(activeWorkspace);

    if (success) {
      // Also prime the other workspace if different
      if (activeWorkspace !== CACHE_DIR) {
        await runInstall(CACHE_DIR).catch(() => {});
      }
      // Also update the @latest isolated dir if it exists
      if (
        activeWorkspace !== atLatestDir &&
        fs.existsSync(path.join(atLatestDir, "package.json"))
      ) {
        await runInstall(atLatestDir).catch(() => {});
      }
    }

    return {
      currentVersion,
      latestVersion,
      updated: success,
      error: success ? undefined : "bun install failed",
    };
  } catch (err) {
    return {
      currentVersion,
      latestVersion,
      updated: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

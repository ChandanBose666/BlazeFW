import { spawnSync } from 'node:child_process';

export type PackageManager = 'pnpm' | 'npm' | 'yarn';

export interface InstallOptions {
  destDir: string;
  pkgManager: PackageManager;
}

/**
 * Runs `<pkgManager> install` synchronously inside destDir.
 * Throws if the install process exits with a non-zero code.
 */
export function install({ destDir, pkgManager }: InstallOptions): void {
  const result = spawnSync(pkgManager, ['install'], {
    cwd: destDir,
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim();
    throw new Error(
      `${pkgManager} install failed (exit ${result.status ?? 'unknown'})${stderr ? `:\n${stderr}` : ''}`,
    );
  }
}

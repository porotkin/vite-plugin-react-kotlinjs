import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// Kotlin/JS installs npm dependencies under `build/js`, not next to `vite.config`,
// so tooling is resolved from the Kotlin/JS project to use its own versions.
const PACKAGE_JSON_CANDIDATES = ['build/js/package.json', '../build/js/package.json', '../../package.json', 'package.json'];

function createProjectRequire() {
    const packageJson = PACKAGE_JSON_CANDIDATES
        .map((candidate) => path.resolve(process.cwd(), candidate))
        .find((candidate) => fs.existsSync(candidate));
    return createRequire(packageJson ?? import.meta.url);
}

export const projectRequire = createProjectRequire();

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface CachedTransform<T> {
    get(id: string, source: string): Promise<T | undefined>;
    set(id: string, source: string, result: T): void;
}

const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

export const sha1 = (text: string) => createHash('sha1').update(text).digest('hex');

/**
 * Transform results on disk under `root`, one file per module, each valid while the module's code is the one it was
 * made from. `key` names the directory: what else the result depends on (options, tool versions). Directories of other
 * keys left unused for two weeks are deleted.
 */
export function createTransformCache<T>(root: string, key: string): CachedTransform<T> {
    const dir = path.join(root, sha1(key));
    fs.mkdirSync(dir, { recursive: true });
    const now = new Date();
    fs.utimesSync(dir, now, now);
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const other = path.join(root, entry.name);
        if (entry.isDirectory() && other !== dir && now.getTime() - fs.statSync(other).mtimeMs > STALE_AFTER_MS) {
            fs.rmSync(other, { recursive: true, force: true });
        }
    }
    const file = (id: string) => path.join(dir, `${sha1(id)}.json`);
    return {
        async get(id, source) {
            try {
                const entry = JSON.parse(await fs.promises.readFile(file(id), 'utf8'));
                return entry.source === source ? entry.result : undefined;
            } catch {
                return undefined;
            }
        },
        set(id, source, result) {
            const target = file(id);
            const temp = `${target}.${process.pid}.${Math.random().toString(36).slice(2)}`;
            fs.promises.writeFile(temp, JSON.stringify({ source, result }))
                .then(() => fs.promises.rename(temp, target))
                .catch(() => fs.promises.rm(temp, { force: true }));
        },
    };
}

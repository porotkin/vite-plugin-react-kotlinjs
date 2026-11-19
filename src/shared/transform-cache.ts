import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { threadId } from 'node:worker_threads';

const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_PACKS = 8;
const PACK = '.pack';
const NEWLINE = 0x0a;
const HASH_LENGTH = 40;
const SOURCE_START = HASH_LENGTH + 1;
const RESULT_START = 2 * (HASH_LENGTH + 1);

export const sha1 = (text: string) => createHash('sha1').update(text).digest('hex');

/** Where a module's result goes, handed to the worker that makes it. */
export interface CacheEntry {
    dir: string;
    key: string;
    source: string;
}

export interface TransformCache<T> {
    /** The result stored for module `id` when it was made from code hashing to `source`. */
    read(id: string, source: string): T | undefined;
    entry(id: string, source: string): CacheEntry;
}

interface StoredLine {
    source: string;
    pack: Buffer;
    start: number;
    end: number;
}

/**
 * Transform results on disk under `root`, each valid while the module's code is the one it was made from. `key` names
 * the directory: what else the result depends on (options, tool versions). Directories of other keys left unused for
 * two weeks are deleted. The workers that make results append them to a pack file of their own (`writeCacheEntry`),
 * one line `<sha1(id)> <sha1(code)> <JSON>` each: a file per module spent a quarter of the compile time creating files.
 * Opening the cache indexes every pack, a module's last line winning, and merges them into one beyond eight.
 */
export function createTransformCache<T>(root: string, key: string): TransformCache<T> {
    const dir = path.join(root, sha1(key));
    fs.mkdirSync(dir, { recursive: true });
    deleteStaleSiblings(root, dir);
    const stored = indexPacks(dir);
    return {
        read(id, source) {
            const line = stored.get(sha1(id));
            if (line?.source !== source) return undefined;
            try {
                return JSON.parse(line.pack.toString('utf8', line.start + RESULT_START, line.end)).result;
            } catch {
                return undefined;
            }
        },
        entry: (id, source) => ({ dir, key: sha1(id), source }),
    };
}

function deleteStaleSiblings(root: string, dir: string) {
    const now = new Date();
    fs.utimesSync(dir, now, now);
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const other = path.join(root, entry.name);
        if (entry.isDirectory() && other !== dir && now.getTime() - fs.statSync(other).mtimeMs > STALE_AFTER_MS) {
            fs.rmSync(other, { recursive: true, force: true });
        }
    }
}

function indexPacks(dir: string): Map<string, StoredLine> {
    const names = fs.readdirSync(dir).filter((name) => name.endsWith(PACK));
    const lines = new Map<string, StoredLine>();
    for (const name of names) {
        const pack = fs.readFileSync(path.join(dir, name));
        for (let start = 0, end; (end = pack.indexOf(NEWLINE, start)) !== -1; start = end + 1) {
            const key = pack.toString('latin1', start, start + HASH_LENGTH);
            lines.set(key, { source: pack.toString('latin1', start + SOURCE_START, start + SOURCE_START + HASH_LENGTH), pack, start, end });
        }
    }
    if (names.length > MAX_PACKS) mergePacks(dir, names, lines);
    return lines;
}

function mergePacks(dir: string, names: string[], lines: Map<string, StoredLine>) {
    const merged = path.join(dir, `${process.pid}-merged${PACK}`);
    const temp = `${merged}.tmp`;
    try {
        fs.writeFileSync(temp, Buffer.concat([...lines.values()].map(({ pack, start, end }) => pack.subarray(start, end + 1))));
        fs.renameSync(temp, merged);
        for (const name of names) if (path.join(dir, name) !== merged) fs.rmSync(path.join(dir, name), { force: true });
    } catch {
        fs.rmSync(temp, { force: true });
    }
}

const openPacks = new Map<string, number>();

export function writeCacheEntry({ dir, key, source }: CacheEntry, result: unknown) {
    try {
        let pack = openPacks.get(dir);
        if (pack === undefined) openPacks.set(dir, (pack = fs.openSync(path.join(dir, `${process.pid}-${threadId}${PACK}`), 'a')));
        fs.writeSync(pack, `${key} ${source} ${JSON.stringify({ result })}\n`);
    } catch {}
}

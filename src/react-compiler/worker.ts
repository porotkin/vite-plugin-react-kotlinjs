import { parentPort } from 'node:worker_threads';
import type { ReactCompilerEvent } from '../options';
import { type CacheEntry, writeCacheEntry } from '../shared/transform-cache';
import { compileKotlinMjs } from './compile';
import { compileKotlinMjsWithOxc, compileKotlinMjsWithOxcOnly } from './oxc';

/**
 * `babel-plugin-react-compiler` reports details as class instances whose `reason`, `category`, … are getters, which
 * the structured clone of a worker message drops.
 */
function cloneable(event: ReactCompilerEvent): ReactCompilerEvent {
    const detail = event.detail as any;
    if (!detail || typeof detail !== 'object' || Object.getPrototypeOf(detail) === Object.prototype) return event;
    const { category, reason, description, severity, loc } = detail;
    return { ...event, detail: { ...detail.options, category, reason, description, severity, loc } };
}

const tasks: Record<string, (...args: any[]) => { events: ReactCompilerEvent[] } | undefined> = {
    compileKotlinMjs,
    compileKotlinMjsWithOxc,
    compileKotlinMjsWithOxcOnly,
};

parentPort!.on('message', ({ id, task, args, cache }: { id: number; task: string; args: unknown[]; cache?: CacheEntry }) => {
    try {
        const made = tasks[task](...args);
        const result = made && { ...made, events: made.events.map(cloneable) };
        if (result && cache) writeCacheEntry(cache, result);
        parentPort!.postMessage({ id, result });
    } catch (error: any) {
        parentPort!.postMessage({ id, error: { message: String(error?.message ?? error), stack: error?.stack } });
    }
});

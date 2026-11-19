import { parentPort } from 'node:worker_threads';
import type { ReactCompilerEvent } from '../options';
import { compileKotlinMjs } from './compile';
import { compileKotlinMjsWithOxc } from './oxc';

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

const tasks: Record<string, (...args: any[]) => { events: ReactCompilerEvent[] }> = {
    compileKotlinMjs,
    compileKotlinMjsWithOxc,
};

parentPort!.on('message', ({ id, task, args }) => {
    try {
        const result = tasks[task](...args);
        parentPort!.postMessage({ id, result: { ...result, events: result.events.map(cloneable) } });
    } catch (error: any) {
        parentPort!.postMessage({ id, error: { message: String(error?.message ?? error), stack: error?.stack } });
    }
});

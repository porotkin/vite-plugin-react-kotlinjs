import os from 'node:os';
import { Worker } from 'node:worker_threads';

interface Task {
    resolve: (result: any) => void;
    reject: (error: Error) => void;
}

interface Slot {
    worker: Worker;
    tasks: Map<number, Task>;
}

export interface WorkerPool {
    run<T>(task: string, ...args: unknown[]): Promise<T>;
    terminate(): Promise<void>;
}

/**
 * A quarter of the cores, at most 4: each worker warms up its own copy of the compiler (JIT, heap), which costs more
 * CPU than further workers save time. On 16 cores, 4 workers build as fast as 8 with 4 s less CPU.
 */
const DEFAULT_SIZE = Math.max(1, Math.min(Math.floor(os.availableParallelism() / 4), 4));

/**
 * Runs `script`'s tasks on up to `size` worker threads, started as tasks queue up. A task goes to the worker with the
 * fewest in flight; a worker without any is unreferenced, so it never keeps the process alive.
 */
export function createWorkerPool(script: URL, size = DEFAULT_SIZE): WorkerPool {
    const slots: Slot[] = [];
    let nextId = 0;

    function spawn(): Slot {
        const slot: Slot = { worker: new Worker(script), tasks: new Map() };
        slot.worker.unref();
        slot.worker.on('message', ({ id, result, error }) => {
            const task = slot.tasks.get(id)!;
            slot.tasks.delete(id);
            if (slot.tasks.size === 0) slot.worker.unref();
            if (error) task.reject(Object.assign(new Error(error.message), { stack: error.stack }));
            else task.resolve(result);
        });
        slot.worker.on('error', (error) => {
            slots.splice(slots.indexOf(slot), 1);
            for (const task of slot.tasks.values()) task.reject(error);
        });
        slots.push(slot);
        return slot;
    }

    function leastBusy(): Slot {
        const slot = slots.reduce<Slot | undefined>((best, it) => (!best || it.tasks.size < best.tasks.size ? it : best), undefined);
        return slot && (slot.tasks.size === 0 || slots.length >= size) ? slot : spawn();
    }

    return {
        run(task, ...args) {
            const slot = leastBusy();
            const id = nextId++;
            if (slot.tasks.size === 0) slot.worker.ref();
            return new Promise((resolve, reject) => {
                slot.tasks.set(id, { resolve, reject });
                slot.worker.postMessage({ id, task, args });
            });
        },
        async terminate() {
            await Promise.all(slots.splice(0).map(({ worker }) => worker.terminate()));
        },
    };
}

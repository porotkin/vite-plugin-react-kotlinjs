import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ResolvedOptions } from '../options';
import { createTransformPlugin } from '../shared/plugin';
import { projectRequire } from '../shared/project';
import { type CacheEntry, createTransformCache, sha1, type TransformCache } from '../shared/transform-cache';
import { createWorkerPool } from '../shared/worker-pool';
import { type CompileKotlinMjsResult, importsKrcMutableValue, KRC_USE_MEMO } from './compile';
import { jsxUnwrapRuntime } from './oxc';

const USE_MEMO_DIRECTIVE = /["']use memo["']/;

/** Compiles modules opting in with `"use memo"`, plus every React module unless in `annotation` mode. */
export function reactCompilerPlugin(options: ResolvedOptions) {
    const tasks = compilerTasks(options);
    const { codeInclude, selected } = selectsModule(options);
    const task = options.backend === 'oxc' ? 'compileKotlinMjsWithOxc' : 'compileKotlinMjs';
    const compiler = createTransformPlugin({
        name: 'kotlin-react-compiler',
        include: options.include,
        codeInclude,
        transform(code, id) {
            return selected(code) ? tasks.run(task, code, id) : undefined;
        },
        debug: options.debug,
    });
    return [{
        ...compiler,
        ...(options.backend === 'oxc' && jsxUnwrapRuntime),
        configResolved: tasks.configure,
        closeBundle: tasks.terminate,
    }];
}

function selectsModule({ compilationMode, isReactFC, reactModuleMarkers }: ResolvedOptions) {
    const annotationOnly = compilationMode === 'annotation';
    return {
        codeInclude: annotationOnly ? [USE_MEMO_DIRECTIVE, KRC_USE_MEMO] : reactModuleMarkers && [USE_MEMO_DIRECTIVE, KRC_USE_MEMO, ...reactModuleMarkers],
        selected: (code: string) => USE_MEMO_DIRECTIVE.test(code) || KRC_USE_MEMO.test(code) || (!annotationOnly && isReactFC(code)),
    };
}

export interface ResolvedConfig {
    command: string;
    cacheDir: string;
    build: { sourcemap: unknown };
}

type Task = 'compileKotlinMjs' | 'compileKotlinMjsWithOxc';

/** The oxc backend's modules that need Babel go to a pool of one worker: a worker loading it costs ~1 s of CPU. */
const BABEL_WORKERS = 1;

/**
 * Compiles on worker threads: Vite calls the transform hooks of many modules at once, so the compiler barely adds to
 * the time of a build or a page load, where on the main thread it held up every other plugin and module. Source maps
 * are made only where something reads them: on the dev server, and in builds that emit them. Results are kept in Vite's
 * `cacheDir`, so a module compiles again only when its code, the options or the tools change.
 */
function compilerTasks(options: ResolvedOptions) {
    const script = new URL('./worker.js', import.meta.url);
    const pool = createWorkerPool(script);
    const babelPool = createWorkerPool(script, BABEL_WORKERS);
    const compile = async (task: Task, code: string, id: string, entry?: CacheEntry) => {
        const args = [code, id, compileOptions];
        if (task === 'compileKotlinMjs') return pool.run<CompileKotlinMjsResult>(task, args, entry);
        const withoutBabel = importsKrcMutableValue(code)
            ? undefined
            : await pool.run<CompileKotlinMjsResult | undefined>('compileKotlinMjsWithOxcOnly', args, entry);
        return withoutBabel ?? babelPool.run<CompileKotlinMjsResult>(task, args, entry);
    };
    const { backend, compilationMode, preserveExistingMemoizationGuarantees, incompatibleHooks } = options;
    let compileOptions = { compilationMode, preserveExistingMemoizationGuarantees, incompatibleHooks, sourceMaps: true };
    let cache: TransformCache<CompileKotlinMjsResult> | undefined;
    return {
        configure(config: ResolvedConfig) {
            const sourceMaps = config.command === 'serve' || Boolean(config.build.sourcemap);
            compileOptions = { ...compileOptions, sourceMaps };
            const key = JSON.stringify({ backend, ...compileOptions, plugin: ownCodeHash(), tools: TOOLS.map(packageVersion) });
            cache = createTransformCache(path.join(config.cacheDir, 'vite-plugin-react-kotlinjs'), key);
        },
        async run(task: Task, code: string, id: string) {
            const source = cache && sha1(code);
            const result = (source && cache!.read(id, source)) || await compile(task, code, id, source ? cache!.entry(id, source) : undefined);
            for (const event of result.events) options.logger?.logEvent(id, event);
            return { code: result.code, map: result.map };
        },
        async terminate() {
            await Promise.all([pool.terminate(), babelPool.terminate()]);
        },
    };
}

const TOOLS = ['@babel/core', 'babel-plugin-react-compiler', 'oxc-transform-react'];

function packageVersion(name: string): string {
    try {
        for (let dir = path.dirname(projectRequire.resolve(name)); dir !== path.dirname(dir); dir = path.dirname(dir)) {
            const file = path.join(dir, 'package.json');
            if (!fs.existsSync(file)) continue;
            const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (pkg.name === name) return pkg.version;
        }
    } catch {
        // not installed
    }
    return '';
}

/** The plugin's own built code, so that a changed plugin of the same version does not reuse results. */
function ownCodeHash(): string {
    const dist = path.dirname(fileURLToPath(import.meta.url));
    const files = fs.readdirSync(dist).filter((name) => name.endsWith('.js')).sort();
    return sha1(files.map((name) => fs.readFileSync(path.join(dist, name), 'utf8')).join('\0'));
}

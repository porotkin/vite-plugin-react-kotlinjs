import {DEFAULT_COMPILATION_MODE, KOTLIN_JSX_RUNTIME, type ReactCompilerEvent, type ReactCompilerOptions} from '../options';
import {projectRequire} from '../shared/project';
import {babelPrepass} from './babel-prepass';

export interface CompileKotlinMjsResult {
    code: string;
    map: object | null;
    events: ReactCompilerEvent[];
}

const jsxFunction = {
    kind: 'function',
    positionalParams: ['read', 'freeze', 'read'],
    restParam: null,
    calleeEffect: 'read',
    returnType: { kind: 'type', name: 'Any' },
    returnValueKind: 'frozen',
};

const reactJsxRuntime = { kind: 'object', properties: { jsx: jsxFunction, jsxs: jsxFunction } };
// Kotlin/JS imports kotlin-react's `jsx()` under a mangled name (`jsx2uf3lx2x6pvok`), so `'*'` types every export.
const kotlinJsxRuntime = { kind: 'object', properties: { '*': jsxFunction } };

/**
 * kotlin-react-compiler's `mutableValue(x)`, which returns `x`: KRC reads the receiver of a write in an effect or a
 * callback through it, when that receiver is a value React does not own (a DOM node, a ref, a signal). Typed as a value
 * from outside React (`global`), the write compiles in the effect and is still rejected during render.
 */
const mutableValueFunction = {
    kind: 'function',
    positionalParams: ['read'],
    restParam: null,
    calleeEffect: 'read',
    returnType: { kind: 'type', name: 'Any' },
    returnValueKind: 'global',
};
const krcMutableValue = { kind: 'object', properties: { '*': mutableValueFunction } };
// Alone in its file in per-file output; the annotations module's only export in per-module output.
const KRC_MUTABLE_VALUE_MODULES = ['/com/github/porotkin/reactcompiler/MutableValue.mjs', '_reactcompiler_annotations.mjs'];

/**
 * Kotlin/JS calls `jsx()` / `jsxs()` directly, so the compiler is told they freeze props and return frozen values;
 * kotlin-react-compiler's `mutableValue()` is typed as returning a value React does not own.
 */
export function moduleTypeProvider(moduleName: string) {
    if (moduleName === 'react/jsx-runtime') return reactJsxRuntime;
    if (moduleName.endsWith(KOTLIN_JSX_RUNTIME)) return kotlinJsxRuntime;
    return KRC_MUTABLE_VALUE_MODULES.some((suffix) => moduleName.endsWith(suffix)) ? krcMutableValue : null;
}

const incompatibleHook = (knownIncompatible: string) => ({
    kind: 'hook',
    positionalParams: [],
    restParam: 'read',
    returnType: { kind: 'type', name: 'Any' },
    knownIncompatible,
});

/**
 * The hook types of `babel-plugin-react-compiler`'s own `defaultModuleTypeProvider`, which is not exported and which a
 * custom provider replaces. Copied from babel-plugin-react-compiler 1.0.0.
 */
const BUILT_IN_HOOK_TYPES: Record<string, Record<string, object>> = {
    'react-hook-form': {
        // Only the `watch()` function returned by `useForm()` is incompatible.
        useForm: {
            kind: 'hook',
            returnType: {
                kind: 'object',
                properties: {
                    watch: {
                        kind: 'function',
                        positionalParams: [],
                        restParam: 'read',
                        calleeEffect: 'read',
                        returnType: { kind: 'type', name: 'Any' },
                        returnValueKind: 'mutable',
                        knownIncompatible: "React Hook Form's `useForm()` API returns a `watch()` function which cannot be memoized safely.",
                    },
                },
            },
        },
    },
    '@tanstack/react-table': {
        useReactTable: incompatibleHook("TanStack Table's `useReactTable()` API returns functions that cannot be memoized safely"),
    },
    '@tanstack/react-virtual': {
        useVirtualizer: incompatibleHook("TanStack Virtual's `useVirtualizer()` API returns functions that cannot be memoized safely"),
    },
};

/** The built-in hook types of `moduleName`, with the hooks `incompatibleHooks` lists for it typed as known incompatible. */
function libraryModuleType(moduleName: string, incompatibleHooks: Record<string, string[]>) {
    const listed = Object.hasOwn(incompatibleHooks, moduleName) ? incompatibleHooks[moduleName] : [];
    const builtIn = Object.hasOwn(BUILT_IN_HOOK_TYPES, moduleName) ? BUILT_IN_HOOK_TYPES[moduleName] : undefined;
    if (!builtIn && listed.length === 0) return null;
    const listedTypes = listed.map((hook) => [hook, incompatibleHook(`\`${hook}()\` from \`${moduleName}\` is listed in \`incompatibleHooks\``)]);
    return { kind: 'object', properties: { ...builtIn, ...Object.fromEntries(listedTypes) } };
}

let toolchain: { babel: any; reactCompiler: any } | undefined;

/** Lazy: `@babel/core` and `babel-plugin-react-compiler` are only required when the compiler actually runs. */
function loadToolchain() {
    if (!toolchain) {
        const reactCompiler = projectRequire('babel-plugin-react-compiler');
        toolchain = {
            babel: projectRequire('@babel/core'),
            reactCompiler: reactCompiler.default ?? reactCompiler,
        };
    }
    return toolchain;
}

export function compileKotlinMjs(
    code: string,
    filename = 'module.mjs',
    {
        compilationMode = DEFAULT_COMPILATION_MODE,
        preserveExistingMemoizationGuarantees,
        incompatibleHooks = {},
        logger,
    }: ReactCompilerOptions = {},
): CompileKotlinMjsResult {
    const { babel, reactCompiler } = loadToolchain();
    const events: ReactCompilerEvent[] = [];
    const result = babel.transformSync(code, {
        filename,
        sourceType: 'module',
        configFile: false,
        babelrc: false,
        comments: false,
        sourceMaps: true,
        plugins: [
            babelPrepass,
            [
                reactCompiler,
                {
                    compilationMode,
                    panicThreshold: 'none',
                    environment: {
                        moduleTypeProvider: (moduleName: string) =>
                            moduleTypeProvider(moduleName) ?? libraryModuleType(moduleName, incompatibleHooks),
                        enablePreserveExistingMemoizationGuarantees: preserveExistingMemoizationGuarantees,
                        validatePreserveExistingMemoizationGuarantees: preserveExistingMemoizationGuarantees,
                    },
                    logger: { logEvent: (_filename: string, event: ReactCompilerEvent) => events.push(event) },
                },
            ],
        ],
    });
    // Passed on after Babel is done: a logger that throws then fails the build, not a pass of the compiler.
    for (const event of events) logger?.logEvent(filename, event);
    return { code: result?.code ?? code, map: result?.map ?? null, events };
}

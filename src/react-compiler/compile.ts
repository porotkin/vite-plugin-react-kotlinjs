import {DEFAULT_COMPILATION_MODE, KOTLIN_JSX_RUNTIME, type ReactCompilerOptions} from '../options';
import {projectRequire} from '../shared/project';
import {babelPrepass} from './babel-prepass';
import {normalizedSource} from './normalize';

export interface ReactCompilerEvent {
    kind: string;
    fnName?: string | null;
    memoBlocks?: number;
    [key: string]: unknown;
}

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

/** Kotlin/JS calls `jsx()` / `jsxs()` directly, so the compiler is told they freeze props and return frozen values. */
export function moduleTypeProvider(moduleName: string) {
    if (moduleName === 'react/jsx-runtime') return reactJsxRuntime;
    return moduleName.endsWith(KOTLIN_JSX_RUNTIME) ? kotlinJsxRuntime : null;
}

/** Types the hooks listed in `incompatibleHooks` as known incompatible, so the compiler skips functions calling them. */
function incompatibleModuleType(moduleName: string, hooks: string[]) {
    const hookType = (hook: string) => ({
        kind: 'hook',
        positionalParams: [],
        restParam: 'read',
        returnType: { kind: 'type', name: 'Any' },
        knownIncompatible: `\`${hook}()\` from \`${moduleName}\` is listed in \`incompatibleHooks\``,
    });
    return { kind: 'object', properties: Object.fromEntries(hooks.map((hook) => [hook, hookType(hook)])) };
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
    }: ReactCompilerOptions = {},
): CompileKotlinMjsResult {
    const { babel, reactCompiler } = loadToolchain();
    const events: ReactCompilerEvent[] = [];
    const normalized = normalizedSource(code, filename);
    const result = babel.transformSync(normalized.toString(), {
        filename,
        sourceType: 'module',
        configFile: false,
        babelrc: false,
        comments: false,
        sourceMaps: true,
        inputSourceMap: normalized.generateMap({ source: filename, hires: 'boundary' }),
        plugins: [
            babelPrepass,
            [
                reactCompiler,
                {
                    compilationMode,
                    panicThreshold: 'none',
                    environment: {
                        moduleTypeProvider: (moduleName: string) =>
                            moduleTypeProvider(moduleName) ??
                            (Object.hasOwn(incompatibleHooks, moduleName)
                                ? incompatibleModuleType(moduleName, incompatibleHooks[moduleName])
                                : null),
                        enablePreserveExistingMemoizationGuarantees: preserveExistingMemoizationGuarantees,
                        validatePreserveExistingMemoizationGuarantees: preserveExistingMemoizationGuarantees,
                    },
                    logger: { logEvent: (_filename: string, event: ReactCompilerEvent) => events.push(event) },
                },
            ],
        ],
    });
    return { code: result?.code ?? code, map: result?.map ?? null, events };
}

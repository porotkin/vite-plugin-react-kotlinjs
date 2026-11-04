import { DEFAULT_COMPILATION_MODE, type ReactCompilerOptions } from '../options';
import { projectRequire } from '../shared/project';
import { normalizeKotlinMjs } from './normalize';

export interface ReactCompilerEvent {
    kind: string;
    fnName?: string | null;
    memoBlocks?: number;
    [key: string]: unknown;
}

export interface CompileKotlinMjsResult {
    code: string;
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

/** Kotlin/JS calls `jsx()` / `jsxs()` directly, so the compiler is told they freeze props and return frozen values. */
export function moduleTypeProvider(moduleName: string) {
    return moduleName === 'react/jsx-runtime'
        ? { kind: 'object', properties: { jsx: jsxFunction, jsxs: jsxFunction } }
        : null;
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
    { compilationMode = DEFAULT_COMPILATION_MODE }: ReactCompilerOptions = {},
): CompileKotlinMjsResult {
    const { babel, reactCompiler } = loadToolchain();
    const events: ReactCompilerEvent[] = [];
    const result = babel.transformSync(normalizeKotlinMjs(code, filename), {
        filename,
        sourceType: 'module',
        configFile: false,
        babelrc: false,
        comments: false,
        plugins: [
            [
                reactCompiler,
                {
                    compilationMode,
                    panicThreshold: 'none',
                    environment: { moduleTypeProvider },
                    logger: { logEvent: (_filename: string, event: ReactCompilerEvent) => events.push(event) },
                },
            ],
        ],
    });
    return { code: result?.code ?? code, events };
}

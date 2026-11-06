import {DEFAULT_COMPILATION_MODE, type ReactCompilerOptions} from '../options';
import {projectRequire} from '../shared/project';
import {normalizeKotlinMjs} from './normalize';

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

/**
 * Renames repeated binding names inside each top-level function so no two of its bindings share a name.
 * For a shadowed name the compiler renames the later binding to `<name>_<n>` without checking that this name is free
 * (`HIRBuilder.resolveBinding`), while Kotlin/JS names its temporaries exactly that way (`tmp`, `tmp_0`): a bail-out
 * then leaves two `let tmp_0` declarations behind, and a successful compile silently merges two variables into one.
 */
const uniqueBindingNames = {
    pre(file: { path: any }) {
        file.path.traverse({
            Function(fn: any) {
                const scopes = new Set([fn.scope]);
                fn.traverse({Scopable: (path: any) => void scopes.add(path.scope)});
                const names = new Set<string>();
                for (const scope of scopes) {
                    for (const name of Object.keys(scope.bindings)) {
                        if (names.has(name)) scope.rename(name);
                        else names.add(name);
                    }
                }
                fn.skip();
            },
        });
    },
};

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
        preserveExistingMemoizationGuarantees = false,
    }: ReactCompilerOptions = {},
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
            uniqueBindingNames,
            [
                reactCompiler,
                {
                    compilationMode,
                    panicThreshold: 'none',
                    environment: {
                        moduleTypeProvider,
                        enablePreserveExistingMemoizationGuarantees: preserveExistingMemoizationGuarantees,
                        validatePreserveExistingMemoizationGuarantees: preserveExistingMemoizationGuarantees,
                    },
                    logger: { logEvent: (_filename: string, event: ReactCompilerEvent) => events.push(event) },
                },
            ],
        ],
    });
    return { code: result?.code ?? code, events };
}

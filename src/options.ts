export type CompilationMode = 'annotation' | 'infer' | 'syntax' | 'all';

/** An event `babel-plugin-react-compiler` logs for a function: `CompileSuccess`, `CompileError`, `CompileSkip`, … */
export interface ReactCompilerEvent {
    kind: string;
    fnName?: string | null;
    memoBlocks?: number;
    [key: string]: unknown;
}

export interface ReactCompilerOptions {
    compilationMode?: CompilationMode;
    /**
     * Whether to enforce and preserve manual `useMemo` / `useCallback` memoization guarantees.
     * Left unset, React Compiler's own default applies (`true`): functions whose existing memoization
     * cannot be preserved are left uncompiled instead of having their `useMemo` values recomputed.
     */
    preserveExistingMemoizationGuarantees?: boolean;
    /** Hooks the compiler skips functions calling, by module name, e.g. `{ 'react-hook-form': ['useForm'] }`. */
    incompatibleHooks?: Record<string, string[]>;
    /**
     * Receives the events the compiler logged for a module, once the module is compiled. A function behind a
     * `CompileError` is left as Kotlin/JS emitted it, without any memoization; throwing here fails the build.
     */
    logger?: { logEvent: (filename: string, event: ReactCompilerEvent) => void };
    include?: Array<string | RegExp>;
}

export interface Options extends ReactCompilerOptions {
    isReactFC?: (code: string) => boolean;
    getComponentName?: (code: string) => string | undefined;
    debug?: boolean;
    reactCompiler?: boolean | ReactCompilerOptions;
}

export const DEFAULT_COMPILATION_MODE: CompilationMode = 'annotation';
const DEFAULT_INCLUDE = [/\.mjs$/];
/** kotlin-react's JSX runtime module, which Kotlin/JS imports `jsx()` from under a mangled name. */
export const KOTLIN_JSX_RUNTIME = 'kotlin-react/react/jsx/runtime/jsx.mjs';
/** Imports that mark a Kotlin/JS module as React code. */
const REACT_MODULE_MARKERS = ['kotlin-react/react/ChildrenBuilder.mjs', KOTLIN_JSX_RUNTIME, 'react/jsx-runtime'];

const defaultIsReactFC = (code: string) => REACT_MODULE_MARKERS.some((marker) => code.includes(marker));
const defaultGetComponentName = (code: string) => /export {[^}]*get_([\w$]+) as get_[^}]*}/.exec(code)?.[1];

export type ResolvedOptions = ReturnType<typeof resolveOptions>;

/** Values in a `reactCompiler` object override the top-level ones; `reactCompiler: false` disables the compiler. */
export function resolveOptions(options: Options) {
    const overrides = typeof options.reactCompiler === 'object' ? options.reactCompiler : {};
    return {
        reactCompiler: options.reactCompiler !== false,
        compilationMode: overrides.compilationMode ?? options.compilationMode ?? DEFAULT_COMPILATION_MODE,
        preserveExistingMemoizationGuarantees:
            overrides.preserveExistingMemoizationGuarantees ?? options.preserveExistingMemoizationGuarantees,
        incompatibleHooks: overrides.incompatibleHooks ?? options.incompatibleHooks,
        logger: overrides.logger ?? options.logger,
        include: overrides.include ?? options.include ?? DEFAULT_INCLUDE,
        isReactFC: options.isReactFC ?? defaultIsReactFC,
        // A custom `isReactFC` may accept modules without the default markers, so those can't be pre-filtered.
        reactModuleMarkers: options.isReactFC ? undefined : REACT_MODULE_MARKERS,
        getComponentName: options.getComponentName ?? defaultGetComponentName,
        debug: options.debug ?? false,
    };
}

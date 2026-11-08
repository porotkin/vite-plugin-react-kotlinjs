export type CompilationMode = 'annotation' | 'infer' | 'syntax' | 'all';

export interface ReactCompilerOptions {
    compilationMode?: CompilationMode;
    /**
     * Whether to enforce and preserve manual `useMemo` / `useCallback` memoization guarantees.
     * Defaults to `false` so Kotlin/JS hooks omitting stable hook dependencies do not bail out;
     * when `false`, React Compiler infers its own memoization dependencies rather than preserving
     * deliberately incomplete manual dependency lists.
     */
    preserveExistingMemoizationGuarantees?: boolean;
    /** Hooks the compiler skips functions calling, by module name, e.g. `{ 'react-hook-form': ['useForm'] }`. */
    incompatibleHooks?: Record<string, string[]>;
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
const defaultGetComponentName = (code: string) => /export {(?:.|\s)*get_([\w$]+) as get_(?:.|\s)*}/.exec(code)?.[1];

export type ResolvedOptions = ReturnType<typeof resolveOptions>;

/** Values in a `reactCompiler` object override the top-level ones; `reactCompiler: false` disables the compiler. */
export function resolveOptions(options: Options) {
    const overrides = typeof options.reactCompiler === 'object' ? options.reactCompiler : {};
    return {
        reactCompiler: options.reactCompiler !== false,
        compilationMode: overrides.compilationMode ?? options.compilationMode ?? DEFAULT_COMPILATION_MODE,
        preserveExistingMemoizationGuarantees:
            overrides.preserveExistingMemoizationGuarantees ??
            options.preserveExistingMemoizationGuarantees ??
            false,
        incompatibleHooks: overrides.incompatibleHooks ?? options.incompatibleHooks,
        include: overrides.include ?? options.include ?? DEFAULT_INCLUDE,
        isReactFC: options.isReactFC ?? defaultIsReactFC,
        // A custom `isReactFC` may accept modules without the default markers, so those can't be pre-filtered.
        reactModuleMarkers: options.isReactFC ? undefined : REACT_MODULE_MARKERS,
        getComponentName: options.getComponentName ?? defaultGetComponentName,
        debug: options.debug ?? false,
    };
}

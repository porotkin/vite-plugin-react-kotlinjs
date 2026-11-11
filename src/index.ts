import {fastRefreshPlugin} from './fast-refresh/plugin';
import {type Options, type ReactCompilerOptions, resolveOptions} from './options';
import {reactCompilerPlugin} from './react-compiler/plugin';

export type { CompilationMode, Options, ReactCompilerEvent, ReactCompilerOptions } from './options';
export { compileKotlinMjs, moduleTypeProvider } from './react-compiler/compile';
export type { CompileKotlinMjsResult } from './react-compiler/compile';
export { normalizeKotlinMjs } from './react-compiler/normalize';
export { projectRequire } from './shared/project';

export default function reactKotlinJs(options: Options = {}) {
    const resolved = resolveOptions(options);
    // Fast Refresh goes first: `isReactFC` / `getComponentName` match Kotlin/JS output, which the compiler reprints.
    return [
        fastRefreshPlugin(resolved),
        ...(resolved.reactCompiler ? [reactCompilerPlugin(resolved)] : []),
    ];
}

/** Standalone React Compiler pre-transform, without Fast Refresh. */
export function kotlinReactCompilerVitePlugin(options: ReactCompilerOptions = {}) {
    return reactCompilerPlugin(resolveOptions(options));
}

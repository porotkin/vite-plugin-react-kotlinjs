import { fastRefreshPlugin } from './fast-refresh/plugin';
import { type Options, type ReactCompilerOptions, resolveOptions } from './options';
import { reactCompilerPlugin } from './react-compiler/plugin';

export type { CompilationMode, Options, ReactCompilerOptions } from './options';
export { compileKotlinMjs, moduleTypeProvider } from './react-compiler/compile';
export type { CompileKotlinMjsResult, ReactCompilerEvent } from './react-compiler/compile';
export { normalizeKotlinMjs } from './react-compiler/normalize';
export { projectRequire } from './shared/project';

/** React Compiler (optional), then Fast Refresh (dev server only), as two `pre` plugins. */
export default function reactKotlinJs(options: Options = {}) {
    const resolved = resolveOptions(options);
    return [...(resolved.reactCompiler ? [reactCompilerPlugin(resolved)] : []), fastRefreshPlugin(resolved)];
}

/** Standalone React Compiler pre-transform, without Fast Refresh. */
export function kotlinReactCompilerVitePlugin(options: ReactCompilerOptions = {}) {
    return reactCompilerPlugin(resolveOptions(options));
}

import { fastRefreshPlugin } from './fast-refresh/plugin';
import { type Options, resolveOptions } from './options';

export type { CompilationMode, Options, ReactCompilerOptions } from './options';
export { compileKotlinMjs, moduleTypeProvider } from './react-compiler/compile';
export type { CompileKotlinMjsResult, ReactCompilerEvent } from './react-compiler/compile';
export { normalizeKotlinMjs } from './react-compiler/normalize';
export { projectRequire } from './shared/project';

export default function reactKotlinJs(options: Options = {}) {
    return fastRefreshPlugin(resolveOptions(options));
}

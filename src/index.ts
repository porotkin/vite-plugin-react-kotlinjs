import { fastRefreshPlugin } from './fast-refresh/plugin';
import { type Options, resolveOptions } from './options';

export type { Options } from './options';
export { projectRequire } from './shared/project';

export default function reactKotlinJs(options: Options = {}) {
    return fastRefreshPlugin(resolveOptions(options));
}

import {createFilter} from 'vite'
import viteBabelPlugin from './vite-babel'
import viteReactRefreshPlugin from './vite-react-refresh'

export default (options) => {
    const defaultIncludeRE = /\.m?[tj]sx?$/;
    const defaultExcludeRE = /\/node_modules\//;

    const include = options?.include ?? defaultIncludeRE;
    const exclude = options?.exclude ?? defaultExcludeRE;
    const filter = createFilter(include, exclude);

    const derivedOptions = {
        ...options,
        filter,
        skipFastRefresh: true,
    };

    return [
        viteBabelPlugin(derivedOptions),
        viteReactRefreshPlugin(derivedOptions),
    ];
}

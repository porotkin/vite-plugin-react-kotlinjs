import {createFilter} from 'vite'
import {viteBabelPlugin} from './vite-babel.js'
import {viteReactRefreshPlugin} from './vite-react-refresh.js'
import {makeIdFiltersToMatchWithQuery} from "@rolldown/pluginutils";

export default (options) => {
    const defaultIncludeRE = makeIdFiltersToMatchWithQuery("**/*.mjs");
    const defaultExcludeRE = [
        makeIdFiltersToMatchWithQuery("**/use*.mjs"),
        "**/Main.mjs",
    ]

    const include = options?.include ?? defaultIncludeRE;
    const exclude = options?.exclude ?? defaultExcludeRE;
    const filter = createFilter(include, exclude);

    const derivedOptions = {
        skipFastRefresh: true,
        getComponentName: (code) => code.match(/function ([A-Za-z]+)\$lambda\(\$this\$FC\) {/)?.[1],
        filter,
        ...options,
    };

    return [
        viteBabelPlugin(derivedOptions),
        viteReactRefreshPlugin(derivedOptions),
    ];
}

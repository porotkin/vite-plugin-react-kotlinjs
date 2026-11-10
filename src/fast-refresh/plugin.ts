import type { ResolvedOptions } from '../options';
import { createTransformPlugin } from '../shared/plugin';

// `@vitejs/plugin-react` only injects Fast Refresh into modules that mention the JSX dev runtime.
const REACT_PLUGIN_ENABLER = `\nconst $$$___$$$___$$$ = "react/jsx-dev-runtime"\n`;

/**
 * Kotlin/JS exports a component through a `get_X()` getter. Renaming the getter to `GetX`
 * makes React Refresh register it as a component while the export name stays the same.
 * Every reference in the module is renamed with it; only the export alias (`as get_X`) is the name importers use.
 */
export function fastRefreshPlugin({ include, isReactFC, reactModuleMarkers, getComponentName, debug }: ResolvedOptions) {
    return createTransformPlugin({
        name: 'vite:react-plugin-kotlinjs',
        apply: 'serve',
        include,
        codeInclude: reactModuleMarkers,
        transform(code) {
            if (!isReactFC(code)) return undefined;
            const name = getComponentName(code);
            if (!name) return undefined;
            const getter = new RegExp(`(?<![\\w$.]|as )get_${name.replaceAll('$', '\\$')}(?![\\w$])`, 'g');
            return code.replace(getter, () => `Get${name}`) + REACT_PLUGIN_ENABLER;
        },
        debug,
    });
}

import type { ResolvedOptions } from '../options';
import { createTransformPlugin } from '../shared/plugin';

// `@vitejs/plugin-react` only injects Fast Refresh into modules that mention the JSX dev runtime.
const REACT_PLUGIN_ENABLER = `\nconst $$$___$$$___$$$ = "react/jsx-dev-runtime"\n`;

/**
 * Kotlin/JS exports a component through a `get_X()` getter. Renaming the getter to `GetX`
 * makes React Refresh register it as a component while the export name stays the same.
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
            return (
                code
                    .replace(`function get_${name}() {`, `function Get${name}() {`)
                    .replace(`get_${name} as get_`, `Get${name} as get_`) + REACT_PLUGIN_ENABLER
            );
        },
        debug,
    });
}

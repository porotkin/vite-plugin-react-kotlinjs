import type { ResolvedOptions } from '../options';

// `@vitejs/plugin-react` only injects Fast Refresh into modules that mention the JSX dev runtime.
const REACT_PLUGIN_ENABLER = `\nconst $$$___$$$___$$$ = "react/jsx-dev-runtime"\n`;

/**
 * Kotlin/JS exports a component through a `get_X()` getter. Renaming the getter to `GetX`
 * makes React Refresh register it as a component while the export name stays the same.
 */
export function fastRefreshPlugin({ isReactFC, getComponentName, debug }: ResolvedOptions) {
    return {
        name: 'vite:react-plugin-kotlinjs',
        enforce: 'pre' as const,
        apply: 'serve' as const,
        transform(code: string, id: string) {
            if (!isReactFC(code)) return { code, map: null };
            const name = getComponentName(code);
            if (!name) return { code, map: null };
            if (debug) console.log(`[vite-plugin-react-kotlinjs] transformed: ${id}`);
            return {
                code:
                    code
                        .replace(`function get_${name}() {`, `function Get${name}() {`)
                        .replace(`get_${name} as get_`, `Get${name} as get_`) + REACT_PLUGIN_ENABLER,
                map: null,
            };
        },
    };
}

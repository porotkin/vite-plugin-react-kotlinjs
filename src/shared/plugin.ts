export interface TransformPluginConfig {
    name: string;
    apply?: 'serve' | 'build';
    include: Array<string | RegExp>;
    /** Native hook pre-filter on module content; omit to let every included module through. */
    codeInclude?: Array<string | RegExp>;
    /**
     * Returns the rewritten code, or `undefined` to leave the module untouched. A rewrite that moves code returns
     * its source map; `map: null` keeps the module's existing map.
     */
    transform: (code: string, id: string) => { code: string; map: object | null } | undefined;
    debug?: boolean;
}

/** A `pre` plugin applying `transform` to included non-`node_modules` modules. */
export function createTransformPlugin({ name, apply, include, codeInclude, transform, debug = false }: TransformPluginConfig) {
    return {
        name,
        enforce: 'pre' as const,
        ...(apply && { apply }),
        transform: {
            filter: {
                id: { include, exclude: [/node_modules/] },
                ...(codeInclude && { code: { include: codeInclude } }),
            },
            handler(code: string, id: string) {
                const transformed = transform(code, id);
                if (transformed === undefined) return null;
                if (debug) console.log(`[vite-plugin-react-kotlinjs] ${name} transformed: ${id}`);
                return transformed;
            },
        },
    };
}

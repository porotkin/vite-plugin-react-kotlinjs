export interface Options {
    isReactFC?: (code: string) => boolean;
    getComponentName?: (code: string) => string | undefined;
    debug?: boolean;
}

const DEFAULT_INCLUDE = [/\.mjs$/];
/** Imports that mark a Kotlin/JS module as React code. */
const REACT_MODULE_MARKERS = ['kotlin-react/react/ChildrenBuilder.mjs', 'react/jsx-runtime'];

const defaultIsReactFC = (code: string) => REACT_MODULE_MARKERS.some((marker) => code.includes(marker));
const defaultGetComponentName = (code: string) => /export {(?:.|\s)*get_([\w$]+) as get_(?:.|\s)*}/.exec(code)?.[1];

export type ResolvedOptions = ReturnType<typeof resolveOptions>;

export function resolveOptions(options: Options) {
    return {
        include: DEFAULT_INCLUDE,
        isReactFC: options.isReactFC ?? defaultIsReactFC,
        // A custom `isReactFC` may accept modules without the default markers, so those can't be pre-filtered.
        reactModuleMarkers: options.isReactFC ? undefined : REACT_MODULE_MARKERS,
        getComponentName: options.getComponentName ?? defaultGetComponentName,
        debug: options.debug ?? false,
    };
}

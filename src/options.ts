export interface Options {
    isReactFC?: (code: string) => boolean;
    getComponentName?: (code: string) => string | undefined;
    debug?: boolean;
}

/** Imports that mark a Kotlin/JS module as React code. */
const REACT_MODULE_MARKERS = ['kotlin-react/react/ChildrenBuilder.mjs', 'react/jsx-runtime'];

const defaultIsReactFC = (code: string) => REACT_MODULE_MARKERS.some((marker) => code.includes(marker));
const defaultGetComponentName = (code: string) => /export {(?:.|\s)*get_([\w$]+) as get_(?:.|\s)*}/.exec(code)?.[1];

export type ResolvedOptions = ReturnType<typeof resolveOptions>;

export function resolveOptions(options: Options) {
    return {
        isReactFC: options.isReactFC ?? defaultIsReactFC,
        getComponentName: options.getComponentName ?? defaultGetComponentName,
        debug: options.debug ?? false,
    };
}

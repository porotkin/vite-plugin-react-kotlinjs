export interface Options {
    isReactFC?: (code: string) => boolean;
    getComponentName?: (code: string) => string | undefined;
    debug?: boolean;
}

const defaultIsReactFC = (code: string) => code.includes('kotlin-react/react/ChildrenBuilder.mjs');
const defaultGetComponentName = (code: string) => /export {(?:.|\s)*get_([\w$]+) as get_(?:.|\s)*}/.exec(code)?.[1];

export type ResolvedOptions = ReturnType<typeof resolveOptions>;

export function resolveOptions(options: Options) {
    return {
        isReactFC: options.isReactFC ?? defaultIsReactFC,
        getComponentName: options.getComponentName ?? defaultGetComponentName,
        debug: options.debug ?? false,
    };
}

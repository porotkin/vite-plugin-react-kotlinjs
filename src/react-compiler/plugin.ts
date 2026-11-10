import type { ResolvedOptions } from '../options';
import { createTransformPlugin } from '../shared/plugin';
import { compileKotlinMjs } from './compile';

const USE_MEMO_DIRECTIVE = /["']use memo["']/;

/** Compiles modules opting in with `"use memo"`, plus every React module unless in `annotation` mode. */
export function reactCompilerPlugin(options: ResolvedOptions) {
    const { compilationMode, include, isReactFC, reactModuleMarkers, debug } = options;
    const annotationOnly = compilationMode === 'annotation';
    return createTransformPlugin({
        name: 'kotlin-react-compiler',
        include,
        codeInclude: annotationOnly
            ? [USE_MEMO_DIRECTIVE]
            : reactModuleMarkers && [USE_MEMO_DIRECTIVE, ...reactModuleMarkers],
        transform(code, id) {
            if (!USE_MEMO_DIRECTIVE.test(code) && (annotationOnly || !isReactFC(code))) return undefined;
            const { code: compiled, map } = compileKotlinMjs(code, id, options);
            return { code: compiled, map };
        },
        debug,
    });
}

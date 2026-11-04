import type { ResolvedOptions } from '../options';
import { createTransformPlugin } from '../shared/plugin';
import { compileKotlinMjs } from './compile';

const USE_MEMO_DIRECTIVE = /["']use memo["']/;

/** Compiles modules opting in with `"use memo"`, plus every React module unless in `annotation` mode. */
export function reactCompilerPlugin({ compilationMode, include, isReactFC, reactModuleMarkers, debug }: ResolvedOptions) {
    const annotationOnly = compilationMode === 'annotation';
    return createTransformPlugin({
        name: 'kotlin-react-compiler',
        include,
        codeInclude: annotationOnly
            ? [USE_MEMO_DIRECTIVE]
            : reactModuleMarkers && [USE_MEMO_DIRECTIVE, ...reactModuleMarkers],
        transform: (code, id) =>
            USE_MEMO_DIRECTIVE.test(code) || (!annotationOnly && isReactFC(code))
                ? compileKotlinMjs(code, id, { compilationMode }).code
                : undefined,
        debug,
    });
}

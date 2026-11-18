import type { ResolvedOptions } from '../options';
import { createTransformPlugin } from '../shared/plugin';
import { compileKotlinMjs } from './compile';

const USE_MEMO_DIRECTIVE = /["']use memo["']/;

/** Compiles modules opting in with `"use memo"`, plus every React module unless in `annotation` mode. */
export function reactCompilerPlugin(options: ResolvedOptions) {
    const { codeInclude, selected } = selectsModule(options);
    return createTransformPlugin({
        name: 'kotlin-react-compiler',
        include: options.include,
        codeInclude,
        transform(code, id) {
            if (!selected(code)) return undefined;
            const { code: compiled, map } = compileKotlinMjs(code, id, options);
            return { code: compiled, map };
        },
        debug: options.debug,
    });
}

function selectsModule({ compilationMode, isReactFC, reactModuleMarkers }: ResolvedOptions) {
    const annotationOnly = compilationMode === 'annotation';
    return {
        codeInclude: annotationOnly ? [USE_MEMO_DIRECTIVE] : reactModuleMarkers && [USE_MEMO_DIRECTIVE, ...reactModuleMarkers],
        selected: (code: string) => USE_MEMO_DIRECTIVE.test(code) || (!annotationOnly && isReactFC(code)),
    };
}

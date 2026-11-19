import type { ResolvedOptions } from '../options';
import { createTransformPlugin } from '../shared/plugin';
import { compileKotlinMjs, KRC_USE_MEMO } from './compile';
import { compileKotlinMjsWithOxc, jsxUnwrapRuntime } from './oxc';

const USE_MEMO_DIRECTIVE = /["']use memo["']/;

export interface ResolvedConfig {
    command: string;
    build: { sourcemap: unknown };
}

/**
 * Compiles modules opting in with `"use memo"`, plus every React module unless in `annotation` mode. Source maps are
 * made only where something reads them: on the dev server, and in builds that emit them.
 */
export function reactCompilerPlugin(options: ResolvedOptions) {
    const { codeInclude, selected } = selectsModule(options);
    const compile = options.backend === 'oxc' ? compileKotlinMjsWithOxc : compileKotlinMjs;
    const { compilationMode, preserveExistingMemoizationGuarantees, incompatibleHooks } = options;
    let compileOptions = { compilationMode, preserveExistingMemoizationGuarantees, incompatibleHooks, sourceMaps: true };
    const compiler = createTransformPlugin({
        name: 'kotlin-react-compiler',
        include: options.include,
        codeInclude,
        transform(code, id) {
            if (!selected(code)) return undefined;
            const { code: compiled, map, events } = compile(code, id, compileOptions);
            for (const event of events) options.logger?.logEvent(id, event);
            return { code: compiled, map };
        },
        debug: options.debug,
    });
    return [{
        ...compiler,
        ...(options.backend === 'oxc' && jsxUnwrapRuntime),
        configResolved: (config: ResolvedConfig) => {
            compileOptions = { ...compileOptions, sourceMaps: config.command === 'serve' || Boolean(config.build.sourcemap) };
        },
    }];
}

function selectsModule({ compilationMode, isReactFC, reactModuleMarkers }: ResolvedOptions) {
    const annotationOnly = compilationMode === 'annotation';
    return {
        codeInclude: annotationOnly ? [USE_MEMO_DIRECTIVE, KRC_USE_MEMO] : reactModuleMarkers && [USE_MEMO_DIRECTIVE, KRC_USE_MEMO, ...reactModuleMarkers],
        selected: (code: string) => USE_MEMO_DIRECTIVE.test(code) || KRC_USE_MEMO.test(code) || (!annotationOnly && isReactFC(code)),
    };
}

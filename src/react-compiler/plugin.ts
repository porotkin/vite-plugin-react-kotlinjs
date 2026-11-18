import type { ResolvedOptions } from '../options';
import { createTransformPlugin } from '../shared/plugin';
import { compileKotlinMjs, importsKrcMutableValue } from './compile';
import { compilePreparedKotlinMjsWithOxc, jsxUnwrapRuntime, prepareKotlinMjsForOxc } from './oxc';

const USE_MEMO_DIRECTIVE = /["']use memo["']/;
const OXC_PREPARED_MARKER = '/*__VITE_PLUGIN_REACT_KOTLINJS_OXC_PREPARED__*/';
const OXC_PREPARED_SUFFIX = `\n${OXC_PREPARED_MARKER}`;
const OXC_PREPARED_FILTER = /\/\*__VITE_PLUGIN_REACT_KOTLINJS_OXC_PREPARED__\*\/\s*$/;

/** Compiles modules opting in with `"use memo"`, plus every React module unless in `annotation` mode. */
export function reactCompilerPlugin(options: ResolvedOptions) {
    return options.backend === 'oxc' ? oxcReactCompilerPlugins(options) : [babelReactCompilerPlugin(options)];
}

function selectsModule({ compilationMode, isReactFC, reactModuleMarkers }: ResolvedOptions) {
    const annotationOnly = compilationMode === 'annotation';
    return {
        codeInclude: annotationOnly ? [USE_MEMO_DIRECTIVE] : reactModuleMarkers && [USE_MEMO_DIRECTIVE, ...reactModuleMarkers],
        selected: (code: string) => USE_MEMO_DIRECTIVE.test(code) || (!annotationOnly && isReactFC(code)),
    };
}

function babelReactCompilerPlugin(options: ResolvedOptions) {
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

/**
 * Two transforms, so Vite chains the source maps of the Babel prepass and of oxc. A module calling `mutableValue()` is
 * compiled by Babel in the first one: oxc takes no module types, and untyped, a write through it during render compiles.
 */
function oxcReactCompilerPlugins(options: ResolvedOptions) {
    const { codeInclude, selected } = selectsModule(options);
    const prepass = createTransformPlugin({
        name: 'kotlin-react-compiler:prepass',
        include: options.include,
        codeInclude,
        transform(code, id) {
            if (!selected(code)) return undefined;
            if (importsKrcMutableValue(code)) {
                const { code: compiled, map } = compileKotlinMjs(code, id, options);
                return { code: compiled, map };
            }
            const { code: rewritten, map, events } = prepareKotlinMjsForOxc(code, id, options);
            for (const event of events) options.logger?.logEvent(id, event);
            return { code: `${rewritten}${OXC_PREPARED_SUFFIX}`, map };
        },
        debug: options.debug,
    });
    const compiler = createTransformPlugin({
        name: 'kotlin-react-compiler',
        include: options.include,
        codeInclude: [OXC_PREPARED_FILTER],
        transform(code, id) {
            if (!OXC_PREPARED_FILTER.test(code)) return undefined;
            const prepared = code.slice(0, -OXC_PREPARED_SUFFIX.length);
            const { code: compiled, map, events } = compilePreparedKotlinMjsWithOxc(prepared, id, options);
            for (const event of events) options.logger?.logEvent(id, event);
            return { code: compiled, map };
        },
        debug: options.debug,
    });
    return [prepass, { ...compiler, ...jsxUnwrapRuntime }];
}

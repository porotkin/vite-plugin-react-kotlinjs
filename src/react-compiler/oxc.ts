import {DEFAULT_COMPILATION_MODE, KOTLIN_JSX_RUNTIME, type CompilationMode, type ReactCompilerEvent, type ReactCompilerOptions} from '../options';
import {parseAst} from 'vite';
import {projectRequire} from '../shared/project';
import {babelPrepass, mayNeedPrepass} from './babel-prepass';

export const JSX_UNWRAP_SOURCE = 'virtual:kotlin-react-compiler/unwrap';
export const JSX_UNWRAP_RUNTIME = `${JSX_UNWRAP_SOURCE}/jsx-runtime`;
const JSX_UNWRAP_RUNTIME_ID = `\0${JSX_UNWRAP_RUNTIME}`;
export const JSX_UNWRAP_RUNTIME_CODE = `const unwrap = (callee, { a0, a1, a2 }) => callee(a0, a1, a2);
export { unwrap as jsx, unwrap as jsxs };
`;

const ARGUMENT_ATTRIBUTES = ['a0', 'a1', 'a2'];
const REACT_JSX_FUNCTIONS = new Set(['jsx', 'jsxs']);
const INIT_PROPERTIES_MEMO_DIRECTIVES = /(\{)(\r?\n[ \t]*_init_properties_[\w$]+\(\);[ \t]*\r?\n)((?:[ \t]*(?:"use (?:no )?memo"|'use (?:no )?memo');?[ \t]*(?:\r?\n|$))+)/g;

const DIAGNOSTIC_CATEGORIES: Record<string, string> = {
    'Existing memoization could not be preserved': 'PreserveManualMemo',
    'Use of incompatible library': 'IncompatibleLibrary',
};

export interface PreparedModule {
    code: string;
    map: object | null;
    events: ReactCompilerEvent[];
}

function importedName(specifier: any, t: any): string {
    return t.isIdentifier(specifier.node.imported) ? specifier.node.imported.name : specifier.node.imported.value;
}

function isJsxRuntimeImport(source: string, imported: string) {
    return source === 'react/jsx-runtime' ? REACT_JSX_FUNCTIONS.has(imported) : source.endsWith(KOTLIN_JSX_RUNTIME);
}

function capitalizedName(program: any, local: string) {
    const name = local[0].toUpperCase() + local.slice(1);
    return program.scope.hasBinding(name) ? program.scope.generateUid(name).replace(/^_/, 'K') : name;
}

function wrapJsxCallsAsElements(program: any, t: any) {
    const callees = new Set<string>();
    for (const statement of program.get('body')) {
        if (!statement.isImportDeclaration()) continue;
        const source = statement.node.source.value;
        for (const specifier of statement.get('specifiers')) {
            if (!specifier.isImportSpecifier() || !isJsxRuntimeImport(source, importedName(specifier, t))) continue;
            const name = capitalizedName(program, specifier.node.local.name);
            program.scope.rename(specifier.node.local.name, name);
            callees.add(name);
        }
    }
    if (callees.size === 0) return;
    program.traverse({
        CallExpression(call: any) {
            const { callee, arguments: args } = call.node;
            if (!t.isIdentifier(callee) || !callees.has(callee.name)) return;
            if (args.length > ARGUMENT_ATTRIBUTES.length || args.some((arg: any) => t.isSpreadElement(arg))) return;
            const attributes = args.map((arg: any, i: number) =>
                t.jsxAttribute(t.jsxIdentifier(ARGUMENT_ATTRIBUTES[i]), t.jsxExpressionContainer(arg)));
            call.replaceWith(t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(callee.name), attributes, true), null, [], true));
        },
    });
}

function incompatibleHookCalls(program: any, t: any, incompatibleHooks: Record<string, string[]>) {
    const hooks = new Map<string, string>();
    for (const statement of program.get('body')) {
        if (!statement.isImportDeclaration()) continue;
        const source = statement.node.source.value;
        const listed = Object.hasOwn(incompatibleHooks, source) ? incompatibleHooks[source] : [];
        for (const specifier of statement.get('specifiers')) {
            if (specifier.isImportSpecifier() && listed.includes(importedName(specifier, t))) {
                hooks.set(specifier.node.local.name, `\`${importedName(specifier, t)}()\` from \`${source}\``);
            }
        }
    }
    return hooks;
}

function memoDirectiveOf(fn: any, value = 'use memo') {
    const body = fn.node.body?.type === 'BlockStatement' ? fn.node.body : undefined;
    return body?.directives?.find((directive: any) => directive.value.value === value);
}

function optOutIncompatibleHookCallers(
    program: any,
    t: any,
    incompatibleHooks: Record<string, string[]>,
    compilationMode: CompilationMode,
    events: ReactCompilerEvent[],
) {
    const hooks = incompatibleHookCalls(program, t, incompatibleHooks);
    if (hooks.size === 0) return;
    const callers = new Map<any, { fn: any; hook: string }>();
    program.traverse({
        CallExpression(call: any) {
            const { callee } = call.node;
            if (!t.isIdentifier(callee) || !hooks.has(callee.name) || program.scope.getBinding(callee.name) !== call.scope.getBinding(callee.name)) return;
            const hook = hooks.get(callee.name)!;
            let outermost: any;
            for (let fn = call.getFunctionParent(); fn; fn = fn.getFunctionParent()) {
                if (memoDirectiveOf(fn)) callers.set(fn.node, { fn, hook });
                outermost = fn;
            }
            if (compilationMode !== 'annotation' && outermost) callers.set(outermost.node, { fn: outermost, hook });
        },
    });
    for (const { fn, hook } of callers.values()) {
        if (memoDirectiveOf(fn, 'use no memo')) continue;
        const directive = memoDirectiveOf(fn);
        if (directive) directive.value.value = 'use no memo';
        else {
            fn.ensureBlock();
            fn.node.body.directives.push(t.directive(t.directiveLiteral('use no memo')));
        }
        events.push({
            kind: 'CompileError',
            fnName: fn.node.id?.name ?? null,
            fnLoc: fn.node.loc,
            detail: {
                category: 'IncompatibleLibrary',
                reason: 'Use of incompatible library',
                description: `${hook} is listed in \`incompatibleHooks\``,
            },
        });
    }
}

function oxcPrepass(compilationMode: CompilationMode, incompatibleHooks: Record<string, string[]>, events: ReactCompilerEvent[]) {
    return ({ types: t }: { types: any }) => ({
        pre(file: { path: any }) {
            optOutIncompatibleHookCallers(file.path, t, incompatibleHooks, compilationMode, events);
            wrapJsxCallsAsElements(file.path, t);
        },
    });
}

function hoistDirectivesAboveInitProperties(code: string): string {
    return code.replace(INIT_PROPERTIES_MEMO_DIRECTIVES, (_match: string, opening: string, initialization: string, displaced: string) => {
        const directives = [...displaced.matchAll(/(["'])use (?:no )?memo\1/g)].map(([directive]) => `${directive};`).join(' ');
        return `${opening}${directives}${initialization}${displaced.replace(/[^\r\n]/g, ' ')}`;
    });
}

export function prepareKotlinMjsForOxc(
    code: string,
    filename: string,
    { compilationMode = DEFAULT_COMPILATION_MODE, incompatibleHooks = {} }: ReactCompilerOptions = {},
): PreparedModule {
    const hoisted = hoistDirectivesAboveInitProperties(code);
    const hasJsxRuntimeImport = code.includes('react/jsx-runtime') || code.includes(KOTLIN_JSX_RUNTIME);
    const hasIncompatibleHookSource = Object.keys(incompatibleHooks).some((source) => code.includes(source));
    if (!mayNeedPrepass(hoisted) && !hasJsxRuntimeImport && !hasIncompatibleHookSource) {
        return { code: hoisted, map: null, events: [] };
    }
    const babel = projectRequire('@babel/core');
    const events: ReactCompilerEvent[] = [];
    const result = babel.transformSync(code, {
        filename,
        sourceType: 'module',
        configFile: false,
        babelrc: false,
        comments: false,
        retainLines: true,
        sourceMaps: true,
        plugins: [babelPrepass, oxcPrepass(compilationMode, incompatibleHooks, events)],
    });
    return { code: result?.code ?? code, map: result?.map ?? null, events };
}

let oxc: { transformSync: (filename: string, code: string, options: object) => any } | undefined;

interface OxcDiagnostic {
    message: string;
    labels: Array<{ start: number }>;
    helpMessage: string | null;
}

interface SourceFunction {
    name: string | null;
    start: number;
    end: number;
}

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

function position(code: string, offset: number) {
    const lines = code.slice(0, offset).split('\n');
    return { line: lines.length, column: lines[lines.length - 1].length };
}

/** The outermost function around `offset`, which is the one React Compiler compiles or leaves as it is. */
function functionAround(node: any, offset: number, name: string | null = null): SourceFunction | undefined {
    if (FUNCTION_TYPES.has(node.type)) return { name: node.id?.name ?? name, start: node.start, end: node.end };
    const childName = node.type === 'VariableDeclarator' && node.id.type === 'Identifier' ? node.id.name : name;
    for (const value of Object.values(node)) {
        for (const child of Array.isArray(value) ? value : [value]) {
            if (typeof child?.type !== 'string' || offset < child.start || offset >= child.end) continue;
            return functionAround(child, offset, childName);
        }
    }
    return undefined;
}

/** oxc reports UTF-8 byte offsets; `labels[0]` points into the function the diagnostic is about. */
function diagnosticEvents(code: string, diagnostics: OxcDiagnostic[]): ReactCompilerEvent[] {
    if (diagnostics.length === 0) return [];
    const bytes = Buffer.from(code);
    const program = parseAst(code, { lang: 'jsx' });
    return diagnostics.map(({ message, labels, helpMessage }) => {
        const [reason] = message.split('\n');
        const offset = labels.length === 0 ? undefined : bytes.subarray(0, labels[0].start).toString().length;
        const fn = offset === undefined ? undefined : functionAround(program, offset);
        return {
            kind: 'CompileError',
            fnName: fn?.name ?? null,
            fnLoc: fn ? { start: position(code, fn.start), end: position(code, fn.end) } : null,
            detail: {
                category: DIAGNOSTIC_CATEGORIES[reason] ?? 'Unknown',
                reason,
                description: helpMessage,
                loc: offset === undefined ? null : { start: position(code, offset) },
            },
        };
    });
}

export function compilePreparedKotlinMjsWithOxc(
    prepared: string,
    filename: string,
    { compilationMode = DEFAULT_COMPILATION_MODE, preserveExistingMemoizationGuarantees }: ReactCompilerOptions = {},
) {
    oxc ??= projectRequire('oxc-transform-react');
    const result = oxc!.transformSync(filename, prepared, {
        lang: 'jsx',
        sourceType: 'module',
        sourcemap: true,
        jsx: { runtime: 'automatic', importSource: JSX_UNWRAP_SOURCE, development: false },
        reactCompiler: {
            compilationMode,
            panicThreshold: 'none',
            reportDiagnostics: true,
            target: '19',
            environment: {
                enablePreserveExistingMemoizationGuarantees: preserveExistingMemoizationGuarantees,
                validatePreserveExistingMemoizationGuarantees: preserveExistingMemoizationGuarantees,
                validateExhaustiveMemoizationDependencies: false,
                validateExhaustiveEffectDependencies: 'off',
            },
        },
    });
    if (result.fatal) throw new Error(`[vite-plugin-react-kotlinjs] ${filename}: ${result.errors.map((e: { message: string }) => e.message).join('\n')}`);
    const events = diagnosticEvents(prepared, result.errors);
    return { code: result.code as string, map: (result.map ?? null) as object | null, events };
}

export const jsxUnwrapRuntime = {
    resolveId: (id: string) => (id === JSX_UNWRAP_RUNTIME ? JSX_UNWRAP_RUNTIME_ID : null),
    load: (id: string) => (id === JSX_UNWRAP_RUNTIME_ID ? JSX_UNWRAP_RUNTIME_CODE : null),
};

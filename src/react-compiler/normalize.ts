import type {
    ArrowFunctionExpression,
    BindingIdentifier,
    Directive,
    Expression,
    Function,
    Program,
    Span,
    Statement,
    VariableDeclarator,
} from '@oxc-project/types';
import {importFromProject} from '../shared/project';
import {applyEdits, type TextEdit} from './text-edits';

const {parseSync, Visitor}: typeof import('rolldown/utils') = await importFromProject('rolldown/utils');

const STATE_HOOKS = new Set(['useState', 'useTransition']);
const CALLBACK_HOOKS = new Set(['useMemo', 'useCallback', 'useEffect']);
// Kotlin names lambdas `useFoo$...` / `Component$lambda$...`; the compiler would mistake them for hooks/components.
const SYNTHETIC_HELPER = /^(?:use[A-Z0-9]\w*|[A-Z]\w*\$lambda)\$/;

/**
 * Rewrites Kotlin/JS output into code `babel-plugin-react-compiler` can analyse:
 * - `var` → `let`
 * - `_` prefix on synthetic `use*$` / `Component$lambda$` helpers
 * - indexed `useState` / `useTransition` results → array destructuring
 * - lifted `useMemo` / `useCallback` / `useEffect` callbacks → inline arrows
 * - trailing `return Unit_getInstance()` dropped from effects
 */
export function normalizeKotlinMjs(code: string, filename = 'module.mjs'): string {
    const { program } = parseSync(filename, code, { lang: 'js' });
    const scope = analyzeModule(program.body);
    const renames = syntheticHelperRenames(scope.functions);

    // Structural edits replace whole constructs and win over the leaf edits nested inside them.
    // Leaf edits are token-level and are replayed when a lifted callback is copied inline.
    const structural: TextEdit[] = [];
    const leaf: TextEdit[] = [];
    const inlined: Array<{ reference: Span; fn: Function }> = [];

    new Visitor({
        VariableDeclaration(node) {
            if (node.kind === 'var') leaf.push({ start: node.start, end: node.start + 3, text: 'let' });
        },
        Identifier(node) {
            const rename = renames.get(node.name);
            if (rename) leaf.push({ start: node.start, end: node.end, text: rename });
        },
        CallExpression(node) {
            if (!scope.isReactHook(node.callee, CALLBACK_HOOKS)) return;
            const callback = node.arguments[0];
            const lifted = callback?.type === 'Identifier' ? scope.functions.get(callback.name) : undefined;
            const inlinable = lifted && !lifted.generator && !lifted.async ? lifted : undefined;
            const fn = inlinable ?? (callback?.type === 'ArrowFunctionExpression' ? callback : undefined);
            if (fn && scope.importOf(node.callee)?.name === 'useEffect') leaf.push(...dropTrailingUnitReturn(fn, scope));
            if (inlinable) inlined.push({ reference: callback, fn: inlinable });
        },
        BlockStatement(node) {
            structural.push(...destructureStateHooks(node.body, scope));
        },
    }).visit(program);

    for (const { reference, fn } of inlined) {
        structural.push({ start: reference.start, end: reference.end, text: toArrow(code, fn, leaf) });
    }
    return applyEdits(code, [...structural, ...leaf]);
}

type ModuleScope = ReturnType<typeof analyzeModule>;

/** Top-level named imports and function declarations of a module. */
function analyzeModule(body: Program['body']) {
    const imports = new Map<string, { source: string; name: string }>();
    const functions = new Map<string, Function>();
    for (const statement of body) {
        if (statement.type === 'ImportDeclaration') {
            for (const specifier of statement.specifiers) {
                if (specifier.type !== 'ImportSpecifier') continue;
                imports.set(specifier.local.name, {
                    source: statement.source.value,
                    name: specifier.imported.type === 'Literal' ? specifier.imported.value : specifier.imported.name,
                });
            }
        } else if (statement.type === 'FunctionDeclaration' && statement.id) {
            functions.set(statement.id.name, statement);
        }
    }

    const importOf = (node: Expression | null | undefined) => (node?.type === 'Identifier' ? imports.get(node.name) : undefined);
    return {
        functions,
        importOf,
        isReactHook(node: Expression, hooks: Set<string>) {
            const binding = importOf(node);
            return binding?.source === 'react' && hooks.has(binding.name);
        },
        isUnitInstanceCall(node: Expression | null) {
            return node?.type === 'CallExpression' && Boolean(importOf(node.callee)?.name.startsWith('Unit_getInstance'));
        },
    };
}

function syntheticHelperRenames(functions: Map<string, unknown>) {
    return new Map(
        [...functions.keys()]
            .filter((name) => SYNTHETIC_HELPER.test(name) && !functions.has(`_${name}`))
            .map((name) => [name, `_${name}`]),
    );
}

/** An effect may only return a cleanup function, never Kotlin's `Unit`. */
function dropTrailingUnitReturn(fn: Function | ArrowFunctionExpression, scope: ModuleScope): TextEdit[] {
    const last = fn.body?.type === 'BlockStatement' ? fn.body.body.at(-1) : undefined;
    return last?.type === 'ReturnStatement' && scope.isUnitInstanceCall(last.argument)
        ? [{ start: last.start, end: last.end, text: '' }]
        : [];
}

/** Renders a hoisted function declaration as an arrow, keeping the leaf edits made inside it. */
function toArrow(code: string, fn: Function, leaf: TextEdit[]): string {
    const params = fn.params.map((param) => applyEdits(code, leaf, param.start, param.end));
    return `(${params.join(', ')}) => ${applyEdits(code, leaf, fn.body!.start, fn.body!.end)}`;
}

/**
 * `var t = useState(x); var a = t[0]; var b = t[1];` → `let [a, b] = useState(x);`
 * `var a = useState(x)[0];`                          → `let [a] = useState(x);`
 */
function destructureStateHooks(statements: Array<Directive | Statement>, scope: ModuleScope): TextEdit[] {
    const isStateHookCall = (node: Expression | null | undefined) => node?.type === 'CallExpression' && scope.isReactHook(node.callee, STATE_HOOKS);
    const bindAs = (statement: Span, head: IdentifierDeclarator, names: string[]): TextEdit => ({
        start: statement.start,
        end: head.id.end,
        text: `let [${names.join(', ')}]`,
    });
    const remove = (node: Span): TextEdit => ({start: node.start, end: node.end, text: ''});

    const edits: TextEdit[] = [];
    for (let i = 0; i < statements.length; i++) {
        const head = singleDeclarator(statements[i]);
        if (!head?.init) continue;

        const single = indexedAccess(head.init);
        if (single?.index === 0 && isStateHookCall(single.target)) {
            edits.push(bindAs(statements[i], head, [head.id.name]), {
                start: single.target.end,
                end: head.init.end,
                text: ''
            });
            continue;
        }

        if (!isStateHookCall(head.init)) continue;
        const value = singleDeclarator(statements[i + 1]);
        const setter = singleDeclarator(statements[i + 2]);
        if (readsIndex(value, head.id.name, 0) && readsIndex(setter, head.id.name, 1)) {
            edits.push(bindAs(statements[i], head, [value.id.name, setter.id.name]), remove(statements[i + 1]), remove(statements[i + 2]));
            i += 2;
        }
    }
    return edits;
}

type IdentifierDeclarator = VariableDeclarator & { id: BindingIdentifier };

/** The declarator of `var <identifier> = ...` with exactly one binding. */
function singleDeclarator(statement: Directive | Statement | undefined) {
    return statement?.type === 'VariableDeclaration' &&
        statement.declarations.length === 1 &&
        statement.declarations[0].id.type === 'Identifier'
        ? (statement.declarations[0] as IdentifierDeclarator)
        : undefined;
}

/** Whether `declarator` is `... = <name>[index]` or `... = <name>.at(index)`. */
function readsIndex(declarator: IdentifierDeclarator | undefined, name: string, index: number): declarator is IdentifierDeclarator {
    const access = declarator?.init ? indexedAccess(declarator.init) : undefined;
    return access?.index === index && access.target.type === 'Identifier' && access.target.name === name;
}

/** Matches `target[n]` and `target.at(n)` with a numeric literal `n`. */
function indexedAccess(node: Expression): { target: Expression; index: number } | undefined {
    if (node?.type === 'MemberExpression' && node.computed && node.property.type === 'Literal' && typeof node.property.value === 'number') {
        return { target: node.object, index: node.property.value };
    }
    if (
        node?.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        !node.callee.computed &&
        node.callee.property.name === 'at' &&
        node.arguments.length === 1 &&
        node.arguments[0].type === 'Literal' &&
        typeof node.arguments[0].value === 'number'
    ) {
        return { target: node.callee.object, index: node.arguments[0].value };
    }
    return undefined;
}

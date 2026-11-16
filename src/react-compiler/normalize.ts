import type {
    ArrowFunctionExpression,
    BindingIdentifier,
    Directive,
    Expression,
    Function,
    FunctionBody,
    Node,
    Program,
    Span,
    Statement,
    VariableDeclarator,
} from '@oxc-project/types';
import {projectRequire} from '../shared/project';
import type MagicString from 'magic-string';
import {editSource, type TextEdit} from './text-edits';

let oxc: typeof import('rolldown/utils') | undefined;

const STATE_HOOKS = new Set(['useState', 'useTransition']);
// Kotlin names lambdas `useFoo$...` / `Component$lambda$...`; the compiler would mistake them for hooks/components.
const SYNTHETIC_HELPER = /^(?:use[A-Z0-9]\w*|[A-Z]\w*\$lambda)\$/;

type AnyFunction = Function | ArrowFunctionExpression;
type Body = Array<Directive | Statement>;

/**
 * Rewrites Kotlin/JS output into code `babel-plugin-react-compiler` can analyse:
 * - `_` prefix on synthetic `use*$` / `Component$lambda$` helpers
 * - indexed `useState` / `useTransition` results → array destructuring
 * - `BigInt` literals (`1000n`) → `BigInt('1000')`
 * - `"use memo"` / `"use no memo"` moved back to the top of a function body
 * Rewrites that need scope analysis run later, in the Babel pre-pass (`babel-prepass.ts`), `var` → `let` among them.
 */
export function normalizedSource(code: string, filename: string): MagicString {
    // Lazy, like the Babel toolchain: with the compiler off, none of the Kotlin/JS project's tooling is loaded.
    const { parseSync, Visitor } = (oxc ??= projectRequire('rolldown/utils') as typeof import('rolldown/utils'));
    const { program } = parseSync(filename, code, { lang: 'js' });
    const scope = analyzeModule(program.body);
    const renames = syntheticHelperRenames(scope.functions);

    // Structural edits replace whole constructs and win over the leaf edits nested inside them.
    const structural: TextEdit[] = [];
    const leaf: TextEdit[] = [];

    // The function each visited block belongs to, innermost last; outside of functions, the module.
    const owners: unknown[] = [program.body];
    const enterFunction = (fn: AnyFunction) => {
        owners.push(fn);
        if (fn.body?.type === 'BlockStatement') leaf.push(...memoDirectiveHoist(code, fn.body));
    };
    const exitFunction = () => void owners.pop();

    new Visitor({
        FunctionDeclaration: enterFunction,
        'FunctionDeclaration:exit': exitFunction,
        FunctionExpression: enterFunction,
        'FunctionExpression:exit': exitFunction,
        ArrowFunctionExpression: enterFunction,
        'ArrowFunctionExpression:exit': exitFunction,
        Identifier(node) {
            const rename = renames.get(node.name);
            if (rename) leaf.push({ start: node.start, end: node.end, text: rename });
        },
        Literal(node) {
            if ('bigint' in node && node.bigint !== undefined) {
                leaf.push({ start: node.start, end: node.end, text: `BigInt('${node.bigint}')` });
            }
        },
        BlockStatement(node) {
            structural.push(...destructureStateHooks(node.body, owners.at(-1), scope));
        },
    }).visit(program);

    return editSource(code, [...structural, ...leaf]);
}

/** The code of `normalizedSource`, without its source map. */
export function normalizeKotlinMjs(code: string, filename = 'module.mjs'): string {
    return normalizedSource(code, filename).toString();
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
        isReactHook(node: Expression, hooks: Set<string>) {
            const binding = importOf(node);
            return binding?.source === 'react' && hooks.has(binding.name);
        },
    };
}

const MEMO_DIRECTIVES = new Set<unknown>(['use memo', 'use no memo']);

/**
 * Kotlin/JS emits `_init_properties_<File>_kt()` and default-argument handling at the start of a function,
 * pushing `"use memo"` / `"use no memo"` below them, where they are plain expression statements instead of directives.
 * Both move back, in order: an opt-out follows the `"use memo"` the Kotlin plugin puts before it.
 */
function memoDirectiveHoist(code: string, body: FunctionBody): TextEdit[] {
    const misplaced = body.body.filter((statement) =>
        statement.type === 'ExpressionStatement' &&
        !('directive' in statement) &&
        statement.expression.type === 'Literal' &&
        MEMO_DIRECTIVES.has(statement.expression.value));
    if (misplaced.length === 0) return [];
    const indent = code.slice(body.start + 1, body.body[0].start) || '\n  ';
    return misplaced.flatMap((statement) => [
        { start: body.start + 1, end: body.start + 1, text: indent + code.slice(statement.start, statement.end) },
        { start: statement.start, end: statement.end, text: '' },
    ]);
}

function syntheticHelperRenames(functions: Map<string, unknown>) {
    return new Map(
        [...functions.keys()]
            .filter((name) => SYNTHETIC_HELPER.test(name) && !functions.has(`_${name}`))
            .map((name) => [name, `_${name}`]),
    );
}

/**
 * `var t = useState(x); var a = t[0]; var b = t[1];` → `let [a, b] = useState(x);`
 * `var a = useState(x)[0];`                          → `let [a] = useState(x);`
 *
 * A `var` belongs to its whole function, here `owner`, and may be declared again; a `let` belongs to its block and
 * may not. So a name only becomes a `let` when `owner` binds it once and uses it nowhere outside `statements`.
 */
function destructureStateHooks(statements: Body, owner: unknown, scope: ModuleScope): TextEdit[] {
    const isStateHookCall = (node: Expression | null | undefined) => node?.type === 'CallExpression' && scope.isReactHook(node.callee, STATE_HOOKS);
    const keepsMeaningAsLet = (name: string) => bindings(owner, name) === 1 && occurrences(owner, name) === occurrences(statements, name);
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
        if (single?.index === 0 && isStateHookCall(single.target) && keepsMeaningAsLet(head.id.name)) {
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
        // The tuple itself must have no other readers (e.g. Kotlin `val state = useState(); ...; return state`)
        if (
            readsIndex(value, head.id.name, 0) &&
            readsIndex(setter, head.id.name, 1) &&
            !readsBinding(statements.slice(i + 3), head.id.name) &&
            keepsMeaningAsLet(value.id.name) &&
            keepsMeaningAsLet(setter.id.name)
        ) {
            edits.push(bindAs(statements[i], head, [value.id.name, setter.id.name]), remove(statements[i + 1]), remove(statements[i + 2]));
            i += 2;
        }
    }
    return edits;
}

/**
 * Whether `statements` read the tuple `name` declared just before them. Kotlin reuses temporary names
 * (`_destruct__k2r9zo`): reads after a redeclaration, at this level or in a nested block, are of the new value.
 */
function readsBinding(statements: Body, name: string): boolean {
    for (const statement of statements) {
        const redeclared = singleDeclarator(statement);
        if (redeclared?.id.name === name) return mentions(redeclared.init, name);
        if (mentions(statement, name)) return true;
    }
    return false;
}

function mentions(node: unknown, name: string): boolean {
    if (Array.isArray(node)) return node.some((child) => mentions(child, name));
    if (!node || typeof node !== 'object') return false;
    const { type } = node as Node;
    if (type === 'Identifier') return (node as { name: string }).name === name;
    if (type === 'BlockStatement') return readsBinding((node as { body: Body }).body, name);
    return Object.entries(node).some(([key, child]) => key !== 'parent' && mentions(child, name));
}

/** Number of identifiers named `name` in `node`, whatever they refer to. */
function occurrences(node: unknown, name: string): number {
    if (Array.isArray(node)) return node.reduce((count, child) => count + occurrences(child, name), 0);
    if (!node || typeof node !== 'object') return 0;
    if ((node as Node).type === 'Identifier') return Number((node as { name: string }).name === name);
    return Object.entries(node).reduce((count, [key, child]) => (key === 'parent' ? count : count + occurrences(child, name)), 0);
}

/** Number of parameters and `var` declarations binding `name` in `owner`, a function or a module body, nested functions aside. */
function bindings(owner: unknown, name: string): number {
    const declared = (node: unknown): number => {
        if (Array.isArray(node)) return node.reduce((count, child) => count + declared(child), 0);
        if (!node || typeof node !== 'object') return 0;
        const { type } = node as Node;
        if (type === 'FunctionDeclaration' || type === 'FunctionExpression' || type === 'ArrowFunctionExpression') return 0;
        if (type === 'VariableDeclarator') return occurrences((node as VariableDeclarator).id, name);
        return Object.entries(node).reduce((count, [key, child]) => (key === 'parent' ? count : count + declared(child)), 0);
    };
    if (Array.isArray(owner)) return declared(owner);
    const { params, body } = owner as AnyFunction;
    return occurrences(params, name) + declared(body);
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

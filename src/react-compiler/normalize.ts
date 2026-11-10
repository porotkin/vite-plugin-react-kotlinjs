import type {
    ArrowFunctionExpression,
    BindingIdentifier,
    CallExpression,
    Directive,
    Expression,
    Function,
    FunctionBody,
    IdentifierReference,
    MemberExpression,
    Node,
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
const HOOK_NAME = /^use[A-Z0-9]/;
// Kotlin names lambdas `useFoo$...` / `Component$lambda$...`; the compiler would mistake them for hooks/components.
const SYNTHETIC_HELPER = /^(?:use[A-Z0-9]\w*|[A-Z]\w*\$lambda)\$/;

type AnyFunction = Function | ArrowFunctionExpression;
type Body = Array<Directive | Statement>;

/**
 * Rewrites Kotlin/JS output into code `babel-plugin-react-compiler` can analyse:
 * - `_` prefix on synthetic `use*$` / `Component$lambda$` helpers
 * - indexed `useState` / `useTransition` results → array destructuring
 * - lifted `useMemo` / `useCallback` / `useEffect` callbacks, also hoisted as `let tmp = () => ...`, → inline arrows
 * - `$slambda(...)` / `$ref()` callable references passed to hooks → inline arrows
 * - `getLocalDelegateReference` delegate accessors → direct `.current` reads / writes
 * - `BigInt` literals (`1000n`) → `BigInt('1000')`
 * - trailing `return Unit_getInstance()` dropped from effects
 * - `"use memo"` / `"use no memo"` moved back to the top of a function body
 * Rewrites that need scope analysis run later, in the Babel pre-pass (`babel-prepass.ts`), `var` → `let` among them.
 */
export function normalizeKotlinMjs(code: string, filename = 'module.mjs'): string {
    const { program } = parseSync(filename, code, { lang: 'js' });
    const scope = analyzeModule(program.body);
    const renames = syntheticHelperRenames(scope.functions);

    // Structural edits replace whole constructs and win over the leaf edits nested inside them.
    // Leaf edits are token-level and are replayed when a lifted callback is copied inline.
    const structural: TextEdit[] = [];
    const leaf: TextEdit[] = [];
    const inlined: Array<{ reference: Span; fn: AnyFunction }> = [];
    // `let tmp = () => ...` declarations to inline, by the hook argument referencing them.
    const hoisted = new Map<IdentifierReference, ArrowFunctionExpression>();

    const hoistMemoDirective = (fn: AnyFunction) => {
        if (fn.body?.type === 'BlockStatement') leaf.push(...memoDirectiveHoist(code, fn.body));
    };

    new Visitor({
        FunctionDeclaration: hoistMemoDirective,
        FunctionExpression: hoistMemoDirective,
        ArrowFunctionExpression: hoistMemoDirective,
        Identifier(node) {
            const rename = renames.get(node.name);
            if (rename) leaf.push({ start: node.start, end: node.end, text: rename });
        },
        Literal(node) {
            if ('bigint' in node && node.bigint !== undefined) {
                leaf.push({ start: node.start, end: node.end, text: `BigInt('${node.bigint}')` });
            }
        },
        CallExpression(node) {
            const delegateAccess = delegateAccessEdits(node, scope);
            if (delegateAccess.length > 0) {
                leaf.push(...delegateAccess);
                return;
            }
            if (scope.isHookCall(node.callee)) leaf.push(...callableRefWraps(node, scope));

            if (!scope.isReactHook(node.callee, CALLBACK_HOOKS)) return;
            const callback = node.arguments[0];
            const lifted = callback?.type === 'Identifier' ? hoisted.get(callback) ?? scope.functions.get(callback.name) : undefined;
            const inlinable = lifted && !lifted.generator && !lifted.async ? lifted : undefined;
            const fn = inlinable ?? (callback?.type === 'ArrowFunctionExpression' ? callback : undefined);
            if (fn && scope.importOf(node.callee)?.name === 'useEffect') leaf.push(...dropTrailingUnitReturn(fn, scope));
            if (inlinable) inlined.push({ reference: callback, fn: inlinable });
        },
        BlockStatement(node) {
            structural.push(...destructureStateHooks(node.body, scope));
            for (const { declaration, reference, arrow } of hoistedCallbacks(node.body, scope)) {
                structural.push({ start: declaration.start, end: declaration.end, text: '' });
                hoisted.set(reference, arrow);
            }
        },
    }).visit(program);

    for (const { reference, fn } of inlined) {
        structural.push({ start: reference.start, end: reference.end, text: toArrow(code, fn, leaf) });
    }
    return applyEdits(code, [...structural, ...leaf]);
}

type ModuleScope = ReturnType<typeof analyzeModule>;
type CallsHelper = (node: Expression | null | undefined, prefix: string) => node is CallExpression;

/** Top-level named imports and function declarations of a module, and the Kotlin helpers among those functions. */
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
    // Kotlin/JS mangles imported names (`Unit_getInstanceu5z48rdn3d6z`), so its runtime helpers are matched by prefix.
    const callsHelper: CallsHelper = (node, prefix): node is CallExpression =>
        node?.type === 'CallExpression' &&
        node.callee.type === 'Identifier' &&
        (node.callee.name.startsWith(prefix) || Boolean(importOf(node.callee)?.name.startsWith(prefix)));

    const callableRefs = new Map<string, CallableRef>();
    const delegateAccessors = new Map<string, DelegateAccess>();
    for (const [name, fn] of functions) {
        const statements = (fn.body?.body ?? []).filter((statement) => !isInitPropertiesCall(statement));
        const callableRef = matchCallableRef(statements, callsHelper);
        if (callableRef) callableRefs.set(name, callableRef);
        const access = matchDelegateAccessor(fn.params, statements, callsHelper);
        if (access) delegateAccessors.set(name, access);
    }

    return {
        functions,
        callableRefs,
        delegateAccessors,
        importOf,
        callsHelper,
        isHookCall(node: Expression) {
            return node.type === 'Identifier' && (HOOK_NAME.test(node.name) || HOOK_NAME.test(importOf(node)?.name ?? ''));
        },
        isReactHook(node: Expression, hooks: Set<string>) {
            const binding = importOf(node);
            return binding?.source === 'react' && hooks.has(binding.name);
        },
    };
}

function isInitPropertiesCall(statement: Directive | Statement): boolean {
    return (
        statement.type === 'ExpressionStatement' &&
        statement.expression.type === 'CallExpression' &&
        statement.expression.callee.type === 'Identifier' &&
        statement.expression.callee.name.startsWith('_init_properties_')
    );
}

interface CallableRef {
    /** Parameter list of the referenced lambda. */
    params: string;
    /** `$ref` factories (5-arg `constructCallableReference`) attach KCallable metadata; `$slambda` ones (2-arg) don't. */
    hasMetadata: boolean;
}

/** `function f$slambda(...) { return constructCallableReference((a, b) => ..., ...); }` */
function matchCallableRef(statements: Body, callsHelper: CallsHelper): CallableRef | undefined {
    const [statement] = statements;
    const call = statements.length === 1 && statement.type === 'ReturnStatement' ? statement.argument : undefined;
    if (!callsHelper(call, 'constructCallableReference') || call.arguments[0]?.type !== 'ArrowFunctionExpression') return undefined;
    const params = call.arguments[0].params.map((param, i) => (param.type === 'Identifier' ? param.name : `$p${i}`));
    return { params: params.join(', '), hasMetadata: call.arguments.length > 2 };
}

type DelegateAccess = 'get' | 'set';

/**
 * Accessors of a Kotlin local delegate (`var x by useRef(...)`):
 * - `get(d) { getLocalDelegateReference(...); return d.current; }`
 * - `set(d, v) { getLocalDelegateReference(...); d.current = v; return Unit_getInstance(); }`
 */
function matchDelegateAccessor(params: Function['params'], statements: Body, callsHelper: CallsHelper): DelegateAccess | undefined {
    const [reference, first, second] = statements;
    const [delegate, value] = params;
    if (reference?.type !== 'ExpressionStatement' || !callsHelper(reference.expression, 'getLocalDelegateReference')) return undefined;
    if (delegate?.type !== 'Identifier') return undefined;

    if (params.length === 1 && statements.length === 2 && first.type === 'ReturnStatement') {
        return isMemberAccess(first.argument, delegate.name, 'current') ? 'get' : undefined;
    }
    const assignment = first?.type === 'ExpressionStatement' && first.expression.type === 'AssignmentExpression' ? first.expression : undefined;
    return params.length === 2 &&
        statements.length === 3 &&
        value.type === 'Identifier' &&
        assignment?.operator === '=' &&
        isMemberAccess(assignment.left, delegate.name, 'current') &&
        assignment.right.type === 'Identifier' &&
        assignment.right.name === value.name &&
        second.type === 'ReturnStatement' &&
        callsHelper(second.argument, 'Unit_getInstance')
        ? 'set'
        : undefined;
}

function isMemberAccess(node: Node | null | undefined, objectName: string, propertyName: string): node is MemberExpression {
    return (
        node?.type === 'MemberExpression' &&
        !node.computed &&
        !node.optional &&
        node.object.type === 'Identifier' &&
        node.object.name === objectName &&
        node.property.name === propertyName
    );
}

/** `get(d)` → `d.current` and `set(d, v)` → `(d.current = v)` for Kotlin delegate accessors. */
function delegateAccessEdits(call: CallExpression, scope: ModuleScope): TextEdit[] {
    const access = call.callee.type === 'Identifier' ? scope.delegateAccessors.get(call.callee.name) : undefined;
    const [target, value] = call.arguments;
    if (access === 'get' && call.arguments.length === 1) {
        return [
            { start: call.start, end: target.start, text: '' },
            { start: target.end, end: call.end, text: '.current' },
        ];
    }
    if (access === 'set' && call.arguments.length === 2) {
        return [
            { start: call.start, end: target.start, text: '(' },
            { start: target.end, end: value.start, text: '.current = ' },
            { start: value.end, end: call.end, text: ')' },
        ];
    }
    return [];
}

/**
 * `useX(f$slambda(a))` → `useX((p) => f$slambda(a)(p))`, so the factory runs when the callback does: during render,
 * passing it a ref is an error. `$ref` factories carry KCallable metadata a custom hook may read, so they are only
 * wrapped as the inline callback React's `useMemo` / `useCallback` / `useEffect` require.
 */
function callableRefWraps(call: CallExpression, scope: ModuleScope): TextEdit[] {
    const isCallbackHook = scope.isReactHook(call.callee, CALLBACK_HOOKS);
    return call.arguments.flatMap((arg, i) => {
        const ref = arg.type === 'CallExpression' && arg.callee.type === 'Identifier' ? scope.callableRefs.get(arg.callee.name) : undefined;
        if (!ref || (ref.hasMetadata && !(isCallbackHook && i === 0))) return [];
        return [
            { start: arg.start, end: arg.start, text: `(${ref.params}) => ` },
            { start: arg.end, end: arg.end, text: `(${ref.params})` },
        ];
    });
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

/** `var tmp = () => ...;` directly followed by a statement passing `tmp` as the callback of a React callback hook. */
function hoistedCallbacks(statements: Body, scope: ModuleScope) {
    const found: Array<{ declaration: Span; reference: IdentifierReference; arrow: ArrowFunctionExpression }> = [];
    for (let i = 0; i < statements.length - 1; i++) {
        const declarator = singleDeclarator(statements[i]);
        const call = statementValue(statements[i + 1]);
        const reference = call?.type === 'CallExpression' ? call.arguments[0] : undefined;
        if (
            declarator?.init?.type === 'ArrowFunctionExpression' &&
            call?.type === 'CallExpression' &&
            scope.isReactHook(call.callee, CALLBACK_HOOKS) &&
            reference?.type === 'Identifier' &&
            reference.name === declarator.id.name
        ) {
            found.push({ declaration: statements[i], reference, arrow: declarator.init });
        }
    }
    return found;
}

/** The value of `var x = e`, `return e`, `x = e` or `e;`. */
function statementValue(statement: Directive | Statement): Expression | null | undefined {
    if (statement.type === 'ReturnStatement') return statement.argument;
    if (statement.type === 'ExpressionStatement') {
        return statement.expression.type === 'AssignmentExpression' ? statement.expression.right : statement.expression;
    }
    return singleDeclarator(statement)?.init;
}

function syntheticHelperRenames(functions: Map<string, unknown>) {
    return new Map(
        [...functions.keys()]
            .filter((name) => SYNTHETIC_HELPER.test(name) && !functions.has(`_${name}`))
            .map((name) => [name, `_${name}`]),
    );
}

/** An effect may only return a cleanup function, never Kotlin's `Unit`. */
function dropTrailingUnitReturn(fn: AnyFunction, scope: ModuleScope): TextEdit[] {
    const last = fn.body?.type === 'BlockStatement' ? fn.body.body.at(-1) : undefined;
    return last?.type === 'ReturnStatement' && scope.callsHelper(last.argument, 'Unit_getInstance')
        ? [{ start: last.start, end: last.end, text: '' }]
        : [];
}

/** Renders a hoisted function declaration or arrow expression as an arrow, keeping the leaf edits made inside it. */
function toArrow(code: string, fn: AnyFunction, leaf: TextEdit[]): string {
    if (fn.type === 'ArrowFunctionExpression') return applyEdits(code, leaf, fn.start, fn.end);
    const params = fn.params.map((param) => applyEdits(code, leaf, param.start, param.end));
    return `(${params.join(', ')}) => ${applyEdits(code, leaf, fn.body!.start, fn.body!.end)}`;
}

/**
 * `var t = useState(x); var a = t[0]; var b = t[1];` → `let [a, b] = useState(x);`
 * `var a = useState(x)[0];`                          → `let [a] = useState(x);`
 */
function destructureStateHooks(statements: Body, scope: ModuleScope): TextEdit[] {
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
        // The tuple itself must have no other readers (e.g. Kotlin `val state = useState(); ...; return state`)
        if (readsIndex(value, head.id.name, 0) && readsIndex(setter, head.id.name, 1) && !readsBinding(statements.slice(i + 3), head.id.name)) {
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

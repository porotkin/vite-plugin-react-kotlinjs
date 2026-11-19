// oxc's ESTree is untyped here like Babel's paths are in babel-prepass.ts: nodes are `any`.
import MagicString from 'magic-string';
import { parseAst } from '../shared/parse-ast';
import { KOTLIN_JSX_RUNTIME, type ReactCompilerEvent } from '../options';

/**
 * The Babel pre-pass (`babel-prepass.ts`) for the oxc backend in `annotation` mode, as text edits on oxc's AST: no
 * Babel, whose parse, scope crawls and code generation cost more than the compiler, and whose code every worker
 * warms up on its own. It covers what Kotlin/JS emits in nearly every module; for anything else (a `var` that has to
 * move, BigInt, a class, a pattern) it returns `undefined` and the module goes through Babel.
 */
export function lightPrepass(code: string, filename: string, incompatibleHooks: Record<string, string[]>, sourceMaps: boolean) {
    try {
        return new LightPrepass(code, filename, incompatibleHooks).run(sourceMaps);
    } catch (error) {
        if (error instanceof Unsupported) return undefined;
        throw error;
    }
}

class Unsupported extends Error {}

const unsupported = (what: string): never => {
    throw new Unsupported(what);
};

const MEMO_DIRECTIVE_TEXT = /(["'])use (?:no )?memo\1/g;
const MEMO_DIRECTIVES = new Set(['use memo', 'use no memo']);
const STATE_HOOKS = new Set(['useState', 'useTransition']);
const SYNTHETIC_REF_IMPORT = /\$ref(?:[a-z0-9]{8,16})?$/;
const SYNTHETIC_HELPER = /^(?:use[A-Z0-9]\w*|[A-Z]\w*\$lambda)\$/;
const COMPONENT_NAME = /^[A-Z]/;
const ARGUMENT_ATTRIBUTES = ['a0', 'a1', 'a2'];
const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const SUPPORTED = new Set([
    ...FUNCTIONS, 'Identifier', 'Literal', 'TemplateLiteral', 'TemplateElement', 'TaggedTemplateExpression',
    'ArrayExpression', 'ObjectExpression', 'Property', 'SpreadElement', 'MemberExpression', 'ChainExpression',
    'CallExpression', 'NewExpression', 'UnaryExpression', 'UpdateExpression', 'BinaryExpression', 'LogicalExpression',
    'AssignmentExpression', 'ConditionalExpression', 'SequenceExpression', 'ThisExpression', 'AwaitExpression',
    'YieldExpression', 'BlockStatement', 'ExpressionStatement', 'VariableDeclaration', 'VariableDeclarator',
    'ReturnStatement', 'IfStatement', 'WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement',
    'ForOfStatement', 'BreakStatement', 'ContinueStatement', 'LabeledStatement', 'ThrowStatement', 'TryStatement',
    'CatchClause', 'SwitchStatement', 'SwitchCase', 'EmptyStatement',
]);

interface Scope {
    node: any;
    parent: Scope | null;
    fn: any;
    bindings: Binding[];
}

interface Binding {
    name: string;
    kind: string;
    scope: Scope;
    position: number;
    /** Identifier nodes declaring it (a `var` may be declared several times). */
    ids: any[];
    reads: Use[];
    writes: Use[];
    declarators: Array<{ declaration: any; declarator: any; block: any }>;
    finalName?: string;
}

interface Use {
    node: any;
    fn: any;
}

interface VoidGuard {
    left: any;
    test: any;
    value: any;
    alternate?: any;
}

interface Import {
    source: string;
    imported: string;
    declaration: any;
    specifier: any;
}

function forEachChild(node: any, visit: (child: any, key: string) => void) {
    for (const key in node) {
        if (key === 'type' || key === 'start' || key === 'end') continue;
        const value = node[key];
        if (Array.isArray(value)) {
            for (const item of value) if (item && typeof item.type === 'string') visit(item, key);
        } else if (value && typeof value.type === 'string') {
            visit(value, key);
        }
    }
}

class LightPrepass {
    private readonly program: any;
    private readonly edits: MagicString;
    private readonly parents = new Map<any, any>();
    private readonly keys = new Map<any, string>();
    private readonly scopeOf = new Map<any, Scope>();
    private readonly scopes: Scope[] = [];
    private readonly bindingOf = new Map<any, Binding>();
    private readonly imports = new Map<string, Import>();
    private readonly generated = new Set<string>();
    private readonly removed: Array<[number, number]> = [];
    private readonly regenerated = new Set<any>();
    private readonly events: ReactCompilerEvent[] = [];
    private lineStarts: number[] | undefined;

    constructor(private readonly code: string, private readonly filename: string, private readonly incompatibleHooks: Record<string, string[]>) {
        this.program = parseAst(code, { lang: 'js' });
        this.edits = new MagicString(code);
        for (const statement of this.program.body) {
            if (statement.type !== 'ImportDeclaration') continue;
            for (const specifier of statement.specifiers) {
                if (specifier.type !== 'ImportSpecifier') continue;
                const imported = specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value;
                this.imports.set(specifier.local.name, { source: statement.source.value, imported, declaration: statement, specifier });
            }
        }
    }

    run(sourceMaps: boolean) {
        const roots = this.roots();
        if (roots.length > 0) {
            if (roots.some((root) => SYNTHETIC_HELPER.test(root.id?.name ?? ''))) unsupported('synthetic helper root');
            for (const root of roots) this.analyze(root);
            const callers = new Map<any, string>();
            for (const root of roots) this.rewriteCalls(root, callers);
            this.optOut(callers);
            for (const root of roots) this.destructureStateHooks(root);
            for (const root of roots) this.blockScopeVars(root);
            for (const root of roots) {
                this.forEachFunction(root, (fn) => {
                    this.rewriteDefaultParams(fn);
                    this.destructurePropsRef(fn);
                });
            }
            for (const root of roots) this.uniqueBindingNames(root);
            this.aliasModuleNames(roots);
            this.emitRenames();
        }
        const code = this.edits.toString();
        const map = sourceMaps && roots.length > 0
            ? { ...this.edits.generateMap({ hires: true, source: this.filename, file: this.filename, includeContent: true }) }
            : null;
        return { code, map, events: this.events };
    }

    // ---- roots, as `compiledRoots` in babel-prepass.ts ----

    private roots(): any[] {
        const directives = [...this.code.matchAll(MEMO_DIRECTIVE_TEXT)].map((match) => match.index!);
        const hasDirective = (node: any) => directives.some((index) => index >= node.start && index < node.end);
        const roots: any[] = [];
        const findOutermost = (node: any, parent: any) => {
            if (FUNCTIONS.has(node.type)) {
                if (!hasDirective(node)) return;
                roots.push(node);
                if (parent) this.parents.set(node, parent);
                return;
            }
            if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression' || node.type === 'ClassBody' || node.type === 'MethodDefinition') {
                if (hasDirective(node)) unsupported('class');
            }
            forEachChild(node, (child) => findOutermost(child, node));
        };
        for (const statement of this.program.body) {
            if (hasDirective(statement)) findOutermost(statement, null);
        }
        return roots;
    }

    // ---- scope analysis of a root: bindings, then every identifier use ----

    private analyze(root: any) {
        this.declare(root, null, null, '');
        this.resolve(root, null);
    }

    private declare(node: any, parent: any, scope: Scope | null, key: string) {
        if (!SUPPORTED.has(node.type)) unsupported(node.type);
        if (parent) {
            this.parents.set(node, parent);
            this.keys.set(node, key);
        }
        if (node.type === 'Literal' && node.bigint !== undefined) unsupported('BigInt');
        if (FUNCTIONS.has(node.type)) {
            if (node.type === 'FunctionDeclaration' && scope) this.bind(node.id, 'function', scope);
            const fnScope = this.newScope(node, scope, node);
            if (node.type === 'FunctionExpression' && node.id) this.bind(node.id, 'self', fnScope);
            for (const param of node.params) {
                if (param.type !== 'Identifier') unsupported('pattern parameter');
                this.parents.set(param, node);
                this.keys.set(param, 'params');
                this.bind(param, 'param', fnScope);
            }
            if (node.id) {
                this.parents.set(node.id, node);
                this.keys.set(node.id, 'id');
            }
            if (node.body.type === 'BlockStatement') {
                this.parents.set(node.body, node);
                this.keys.set(node.body, 'body');
                this.scopeOf.set(node.body, fnScope);
                for (const statement of node.body.body) this.declare(statement, node.body, fnScope, 'body');
            } else {
                this.declare(node.body, node, fnScope, 'body');
            }
            return;
        }
        let inner = scope!;
        if (node.type === 'BlockStatement' && !(parent && FUNCTIONS.has(parent.type)) && parent?.type !== 'CatchClause') {
            inner = this.newScope(node, scope, scope!.fn);
        } else if (node.type === 'ForStatement' || node.type === 'ForInStatement' || node.type === 'ForOfStatement' || node.type === 'SwitchStatement') {
            inner = this.newScope(node, scope, scope!.fn);
        } else if (node.type === 'CatchClause') {
            inner = this.newScope(node, scope, scope!.fn);
            if (node.param) {
                if (node.param.type !== 'Identifier') unsupported('pattern catch parameter');
                this.parents.set(node.param, node);
                this.keys.set(node.param, 'param');
                this.bind(node.param, 'catch', inner);
            }
            if (node.body) {
                this.parents.set(node.body, node);
                this.keys.set(node.body, 'body');
                this.scopeOf.set(node.body, inner);
                for (const statement of node.body.body) this.declare(statement, node.body, inner, 'body');
            }
            return;
        } else if (node.type === 'VariableDeclaration') {
            for (const declarator of node.declarations) {
                if (declarator.id.type !== 'Identifier') unsupported('pattern declaration');
            }
            const target = node.kind === 'var' ? this.functionScope(scope!) : scope!;
            const block = this.letScopeOf(node, parent, key);
            for (const declarator of node.declarations) {
                const binding = this.bind(declarator.id, node.kind, target);
                if (node.kind === 'var') binding.declarators.push({ declaration: node, declarator, block });
            }
        }
        if (node.type === 'SwitchStatement') {
            this.declare(node.discriminant, node, scope, 'discriminant');
            for (const switchCase of node.cases) this.declare(switchCase, node, inner, 'cases');
            return;
        }
        forEachChild(node, (child, childKey) => this.declare(child, node, inner, childKey));
    }

    private newScope(node: any, parent: Scope | null, fn: any): Scope {
        const scope: Scope = { node, parent, fn, bindings: [] };
        this.scopeOf.set(node, scope);
        this.scopes.push(scope);
        return scope;
    }

    private functionScope(scope: Scope): Scope {
        let current = scope;
        while (current.node !== current.fn) current = current.parent!;
        return current;
    }

    private bind(id: any, kind: string, scope: Scope): Binding {
        const existing = scope.bindings.find((binding) => binding.name === id.name);
        if (existing) {
            if (existing.kind !== 'var' || kind !== 'var') unsupported('redeclaration');
            existing.ids.push(id);
            this.bindingOf.set(id, existing);
            return existing;
        }
        const binding: Binding = { name: id.name, kind, scope, position: id.start, ids: [id], reads: [], writes: [], declarators: [] };
        scope.bindings.push(binding);
        this.bindingOf.set(id, binding);
        return binding;
    }

    private letScopeOf(declaration: any, parent: any, key: string): any {
        if (parent.type === 'BlockStatement') return parent;
        if (parent.type === 'SwitchCase') return this.parents.get(parent);
        if ((parent.type === 'ForStatement' && key === 'init') || ((parent.type === 'ForInStatement' || parent.type === 'ForOfStatement') && key === 'left')) {
            return parent;
        }
        return null;
    }

    private resolve(node: any, scope: Scope | null) {
        const own = this.scopeOf.get(node);
        const current = own ?? scope!;
        if (node.type === 'Identifier') {
            this.use(node, current);
            return;
        }
        forEachChild(node, (child) => this.resolve(child, current));
    }

    private use(id: any, scope: Scope) {
        const parent = this.parents.get(id);
        const key = this.keys.get(id);
        if (!parent) return;
        if (parent.type === 'MemberExpression' && key === 'property' && !parent.computed) return;
        if (parent.type === 'Property' && key === 'key' && !parent.computed) return;
        if ((parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') && key === 'label') return;
        if (this.bindingOf.get(id)?.ids.includes(id)) return;
        const binding = this.lookup(id.name, scope);
        if (!binding) return;
        this.bindingOf.set(id, binding);
        const write = (parent.type === 'AssignmentExpression' && key === 'left') ||
            parent.type === 'UpdateExpression' ||
            ((parent.type === 'ForInStatement' || parent.type === 'ForOfStatement') && key === 'left');
        (write ? binding.writes : binding.reads).push({ node: id, fn: scope.fn });
    }

    private lookup(name: string, scope: Scope | null): Binding | undefined {
        for (let current = scope; current; current = current.parent) {
            const binding = current.bindings.find((it) => it.name === name);
            if (binding) return binding;
        }
        return undefined;
    }

    private isInside(node: any, ancestor: any): boolean {
        for (let current = this.parents.get(node); current; current = this.parents.get(current)) {
            if (current === ancestor) return true;
        }
        return false;
    }

    private functionParent(node: any): any {
        for (let current = this.parents.get(node); current; current = this.parents.get(current)) {
            if (FUNCTIONS.has(current.type)) return current;
        }
        return undefined;
    }

    // ---- default arguments and `props.ref`, as `rewriteDefaultParams` / `destructurePropsRef` in babel-prepass.ts ----

    private rewriteDefaultParams(fn: any) {
        if (fn.body.type !== 'BlockStatement') return;
        for (const statement of fn.body.body) {
            if (this.isInitPropertiesCall(statement) || this.isBareDeclaration(statement) || this.isDirective(statement)) continue;
            const guard = this.voidGuard(statement, fn);
            if (!guard) break;
            this.declareDefaulted(fn, statement, guard);
        }
    }

    private isInitPropertiesCall(statement: any): boolean {
        const expression = statement.type === 'ExpressionStatement' ? statement.expression : undefined;
        return expression?.type === 'CallExpression' && expression.callee.type === 'Identifier' && expression.callee.name.startsWith('_init_properties_');
    }

    private isBareDeclaration(statement: any): boolean {
        return statement.type === 'VariableDeclaration' && statement.declarations.every((declarator: any) => !declarator.init);
    }

    private isDirective(statement: any): boolean {
        return statement.type === 'ExpressionStatement' && statement.expression.type === 'Literal' && MEMO_DIRECTIVES.has(statement.expression.value);
    }

    /** `x = x === VOID ? d : x;` or `if (x === VOID) { x = d; }` on a parameter `x`, `d` not naming `x`, as `voidGuard` in babel-prepass.ts. */
    private voidGuard(statement: any, fn: any): VoidGuard | undefined {
        const assignmentIn = (node: any) =>
            node?.type === 'ExpressionStatement' && node.expression.type === 'AssignmentExpression' && node.expression.operator === '=' && node.expression.left.type === 'Identifier'
                ? node.expression
                : undefined;
        const isVoidTest = (test: any, name: string) =>
            test?.type === 'BinaryExpression' && test.operator === '===' && test.left.type === 'Identifier' && test.left.name === name &&
            test.right.type === 'Identifier' && test.right.name === 'VOID';
        let guard: VoidGuard | undefined;
        const assignment = assignmentIn(statement);
        if (assignment) {
            const { left, right } = assignment;
            if (right.type === 'ConditionalExpression' && isVoidTest(right.test, left.name) && right.alternate.type === 'Identifier' && right.alternate.name === left.name) {
                guard = { left, test: right.test, value: right.consequent, alternate: right.alternate };
            }
        } else if (statement.type === 'IfStatement' && !statement.alternate) {
            const body = statement.consequent.type === 'BlockStatement' ? statement.consequent.body : [statement.consequent];
            const inner = body.length === 1 ? assignmentIn(body[0]) : undefined;
            if (inner && isVoidTest(statement.test, inner.left.name)) guard = { left: inner.left, test: statement.test, value: inner.right };
        }
        const name = guard?.left.name;
        return guard && fn.params.some((param: any) => param.name === name) && !this.names(guard.value, name) ? guard : undefined;
    }

    private names(node: any, name: string): boolean {
        if (node.type === 'Identifier') return node.name === name;
        let found = false;
        forEachChild(node, (child) => {
            found ||= this.names(child, name);
        });
        return found;
    }

    /** `x = x === VOID ? d : x;` → `let x = _x === VOID ? d : _x;`, the parameter renamed to `_x`. */
    private declareDefaulted(fn: any, statement: any, { left, test, value, alternate }: VoidGuard) {
        const scope = this.scopeOf.get(fn)!;
        const param = scope.bindings.find((binding) => binding.kind === 'param' && binding.name === left.name)!;
        const raw = this.uid(left.name);
        const own = new Set([left, test.left, alternate]);
        const local: Binding = {
            name: left.name,
            kind: 'let',
            scope,
            position: statement.start,
            ids: [left],
            reads: param.reads.filter(({ node }) => !own.has(node)),
            writes: param.writes.filter(({ node }) => !own.has(node)),
            declarators: [],
        };
        for (const node of [left, ...local.reads.map((use) => use.node), ...local.writes.map((use) => use.node)]) this.bindingOf.set(node, local);
        scope.bindings.push(local);
        param.name = raw;
        param.finalName = raw;
        param.reads = alternate ? param.reads.filter(({ node }) => node === test.left || node === alternate) : [];
        param.writes = [];
        if (alternate) {
            this.edits.appendLeft(statement.start, 'let ');
        } else {
            this.edits.overwrite(statement.start, left.start, 'let ');
            this.edits.overwrite(left.end, value.start, ` = ${raw} === VOID ? `);
            this.edits.overwrite(value.end, statement.end, ` : ${raw};`);
        }
    }

    /**
     * In a `"use memo"` component, `props.ref` → a `let { ref: _ref } = props` local, unless `props` is null-checked or
     * `props.ref` written.
     */
    private destructurePropsRef(fn: any) {
        const [props] = fn.params;
        if (fn.params.length !== 1 || !this.directives(fn).includes('use memo')) return;
        const name = fn.id?.name ?? (this.parents.get(fn)?.type === 'VariableDeclarator' ? this.parents.get(fn).id.name : undefined);
        if (name && !COMPONENT_NAME.test(name)) return;
        const binding = this.bindingOf.get(props)!;
        const reads = binding.writes.length === 0 ? this.propsRefReads(binding) : [];
        if (reads.length === 0) return;
        const ref = this.uid('ref');
        for (const member of reads) this.edits.overwrite(member.start, member.end, ref);
        const objects = new Set(reads.map((member) => member.object));
        binding.reads = binding.reads.filter(({ node }) => !objects.has(node));
        this.refDeclarations.push({ at: this.directivePrologueEnd(fn), ref, props: binding });
    }

    private readonly refDeclarations: Array<{ at: number; ref: string; props: Binding }> = [];

    private propsRefReads(binding: Binding): any[] {
        const reads = [];
        for (const { node } of binding.reads) {
            const parent = this.parents.get(node);
            if (
                (parent.type === 'MemberExpression' && this.isOptionalChainLink(parent)) ||
                parent.type === 'UnaryExpression' ||
                parent.type === 'BinaryExpression' ||
                parent.type === 'LogicalExpression' ||
                parent.test === node
            ) {
                return [];
            }
            if (parent.type !== 'MemberExpression' || parent.object !== node || parent.computed || parent.property.name !== 'ref') continue;
            const context = this.parents.get(parent);
            if ((context.type === 'AssignmentExpression' && context.left === parent) || context.type === 'UpdateExpression' || (context.type === 'UnaryExpression' && context.operator === 'delete')) {
                return [];
            }
            reads.push(parent);
        }
        return reads;
    }

    /** Whether Babel parses `member` as an `OptionalMemberExpression`: it follows a `?.` of its chain. */
    private isOptionalChainLink(member: any): boolean {
        for (let link = member; link?.type === 'MemberExpression' || link?.type === 'CallExpression'; link = link.type === 'MemberExpression' ? link.object : link.callee) {
            if (link.optional) return true;
        }
        return false;
    }

    private directivePrologueEnd(fn: any): number {
        let end = fn.body.start + 1;
        for (const statement of fn.body.body) {
            if (!this.isDirective(statement)) break;
            end = statement.end;
        }
        return end;
    }

    // ---- directives ----

    /** The function's directives, displaced ones (behind Kotlin's `_init_properties_` call or default arguments) included. */
    private directives(fn: any): string[] {
        if (fn.body.type !== 'BlockStatement') return [];
        return fn.body.body.filter((statement: any) => this.isDirective(statement)).map((statement: any) => statement.expression.value);
    }

    /** Moves displaced directives to the top of their function, with `replace` applied (an opt-out), as Babel does. */
    private placeDirectives(fn: any, replace?: string) {
        if (fn.body.type !== 'BlockStatement') return;
        const statements: any[] = fn.body.body;
        const directives = statements.filter((statement) => this.isDirective(statement));
        if (directives.length === 0) return;
        const prologueLength = statements.findIndex((statement) => !this.isDirective(statement));
        const displaced = prologueLength === -1 ? false : statements.slice(prologueLength).some((statement) => this.isDirective(statement));
        if (!displaced && !replace) return;
        const texts = directives.map((statement) => `'${statement === replace ? 'use no memo' : statement.expression.value}';`);
        for (const statement of directives) this.remove(statement.start, statement.end);
        this.edits.appendLeft(fn.body.start + 1, texts.join(' '));
    }

    // ---- calls in compiled functions: JSX runtime, Object(), incompatible hooks ----

    private rewriteCalls(root: any, callers: Map<any, string>) {
        const tags = this.jsxTags();
        const hooks = this.incompatibleHookNames();
        const visit = (node: any) => {
            if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && !this.bindingOf.get(node.callee)) {
                const name = node.callee.name;
                const hook = hooks.get(name);
                if (hook) this.addHookCallers(node, hook, callers);
                if (name === 'Object' && node.arguments.length === 0) {
                    this.edits.overwrite(node.start, node.end, '{}');
                    return;
                }
                const tag = tags.get(name);
                if (tag && node.arguments.length > 0 && node.arguments.length <= ARGUMENT_ATTRIBUTES.length && !node.arguments.some((arg: any) => arg.type === 'SpreadElement')) {
                    this.wrapJsxCall(node, tag);
                }
            }
            forEachChild(node, visit);
        };
        visit(root);
    }

    private tagsByLocal: Map<string, string> | undefined;

    /** A capitalized second import of each JSX runtime function: its calls in compiled functions become its elements. */
    private jsxTags(): Map<string, string> {
        if (this.tagsByLocal) return this.tagsByLocal;
        this.tagsByLocal = new Map();
        for (const [local, { source, imported, declaration }] of this.imports) {
            const isJsx = source === 'react/jsx-runtime' ? imported === 'jsx' || imported === 'jsxs' : source.endsWith(KOTLIN_JSX_RUNTIME);
            if (!isJsx) continue;
            const capitalized = local[0].toUpperCase() + local.slice(1);
            const tag = this.isTaken(capitalized) ? this.uid(capitalized).replace(/^_/, 'K') : capitalized;
            this.generated.add(tag);
            const last = declaration.specifiers.at(-1);
            this.edits.appendLeft(last.end, `, ${imported} as ${tag}`);
            this.tagsByLocal.set(local, tag);
        }
        return this.tagsByLocal;
    }

    private wrapJsxCall(call: any, tag: string) {
        const args: any[] = call.arguments;
        this.edits.overwrite(call.start, args[0].start, `<${tag} a0={`);
        for (let i = 1; i < args.length; i++) this.edits.overwrite(args[i - 1].end, args[i].start, `} a${i}={`);
        this.edits.overwrite(args.at(-1).end, call.end, '} />');
    }

    private incompatibleHookNames(): Map<string, string> {
        const hooks = new Map<string, string>();
        for (const [local, { source, imported }] of this.imports) {
            const listed = Object.hasOwn(this.incompatibleHooks, source) ? this.incompatibleHooks[source] : [];
            if (listed.includes(imported)) hooks.set(local, `\`${imported}()\` from \`${source}\``);
        }
        return hooks;
    }

    private addHookCallers(call: any, hook: string, callers: Map<any, string>) {
        for (let fn = this.functionParent(call); fn; fn = this.functionParent(fn)) {
            if (this.directives(fn).includes('use memo')) callers.set(fn, hook);
        }
    }

    private optOut(callers: Map<any, string>) {
        const opted = new Set<any>();
        for (const [fn, hook] of callers) {
            if (this.directives(fn).includes('use no memo')) continue;
            opted.add(fn);
            this.events.push({
                kind: 'CompileError',
                fnName: fn.id?.name ?? null,
                fnLoc: { start: this.position(fn.start), end: this.position(fn.end), filename: this.filename },
                detail: {
                    category: 'IncompatibleLibrary',
                    reason: 'Use of incompatible library',
                    description: `${hook} is listed in \`incompatibleHooks\``,
                },
            });
        }
        for (const root of this.scopes.filter((scope) => scope.node === scope.fn).map((scope) => scope.fn)) {
            const statements = root.body.type === 'BlockStatement' ? root.body.body : [];
            const memo = statements.find((statement: any) => this.isDirective(statement) && statement.expression.value === 'use memo');
            this.placeDirectives(root, opted.has(root) ? memo : undefined);
        }
    }

    private position(offset: number) {
        if (!this.lineStarts) {
            this.lineStarts = [0];
            for (let i = this.code.indexOf('\n'); i !== -1; i = this.code.indexOf('\n', i + 1)) this.lineStarts.push(i + 1);
        }
        let low = 0;
        let high = this.lineStarts.length - 1;
        while (low < high) {
            const middle = (low + high + 1) >> 1;
            if (this.lineStarts[middle] <= offset) low = middle;
            else high = middle - 1;
        }
        return { line: low + 1, column: offset - this.lineStarts[low] };
    }

    // ---- state hooks, as `destructureStateHooks` in babel-prepass.ts ----

    private destructureStateHooks(root: any) {
        if (![...this.imports.values()].some(({ source, imported }) => source === 'react' && STATE_HOOKS.has(imported))) return;
        const isStateHookCall = (node: any) => {
            if (node?.type !== 'CallExpression' || node.callee.type !== 'Identifier') return false;
            const entry = this.imports.get(node.callee.name);
            return entry?.source === 'react' && STATE_HOOKS.has(entry.imported);
        };
        const visit = (node: any) => {
            if (node.type === 'BlockStatement') this.destructureIn(node, isStateHookCall);
            forEachChild(node, visit);
        };
        visit(root);
    }

    private destructureIn(block: any, isStateHookCall: (node: any) => boolean) {
        const owner = FUNCTIONS.has(this.parents.get(block)?.type) ? this.parents.get(block) : this.functionParent(block);
        if (!owner) return;
        const ownerScope = this.scopeOf.get(owner)!;
        const keepsMeaningAsLet = (name: string) => {
            const binding = this.lookup(name, ownerScope);
            return binding?.kind === 'var' && binding.scope === ownerScope && binding.writes.length === 0 && binding.declarators.length === 1 &&
                binding.reads.every(({ node }) => this.isInside(node, block));
        };
        const statements: any[] = block.body;
        for (let i = 0; i < statements.length; i++) {
            const head = this.singleDeclarator(statements[i]);
            if (!head?.init) continue;
            const single = this.indexedAccess(head.init);
            if (single?.index === 0 && isStateHookCall(single.target) && keepsMeaningAsLet(head.id.name)) {
                this.toLet(statements[i], [this.bindingOf.get(head.id)!], block);
                this.edits.remove(single.target.end, head.init.end);
                continue;
            }
            if (!isStateHookCall(head.init)) continue;
            const value = this.singleDeclarator(statements[i + 1]);
            const setter = this.singleDeclarator(statements[i + 2]);
            if (
                this.readsIndex(value, head.id.name, 0) &&
                this.readsIndex(setter, head.id.name, 1) &&
                !this.readsBinding(statements.slice(i + 3), head.id.name) &&
                keepsMeaningAsLet(value.id.name) &&
                keepsMeaningAsLet(setter.id.name)
            ) {
                const tuple = this.bindingOf.get(head.id)!;
                tuple.scope.bindings.splice(tuple.scope.bindings.indexOf(tuple), 1);
                this.toLet(statements[i], [this.bindingOf.get(value.id)!, this.bindingOf.get(setter.id)!], block);
                this.remove(statements[i + 1].start, statements[i + 1].end);
                this.remove(statements[i + 2].start, statements[i + 2].end);
                i += 2;
            }
        }
    }

    /** `var t = …` → `let [a, b] = …`, moving `a` and `b` to the scope of `block`. */
    private toLet(statement: any, bindings: Binding[], block: any) {
        const target = this.scopeOf.get(block)!;
        for (const binding of bindings) {
            binding.scope.bindings.splice(binding.scope.bindings.indexOf(binding), 1);
            binding.kind = 'let';
            binding.scope = target;
            binding.position = statement.start;
            binding.declarators = [];
            target.bindings.push(binding);
        }
        const id = statement.declarations[0].id;
        this.regenerated.add(id);
        this.destructurings.push({ statement, bindings });
    }

    private readonly destructurings: Array<{ statement: any; bindings: Binding[] }> = [];

    private singleDeclarator(statement: any) {
        return statement?.type === 'VariableDeclaration' && statement.declarations.length === 1 && statement.declarations[0].id.type === 'Identifier'
            ? statement.declarations[0]
            : undefined;
    }

    private readsIndex(declarator: any, name: string, index: number): boolean {
        const access = declarator?.init ? this.indexedAccess(declarator.init) : undefined;
        return access?.index === index && access.target.type === 'Identifier' && access.target.name === name;
    }

    private indexedAccess(node: any): { target: any; index: number } | undefined {
        const isNumber = (it: any) => it?.type === 'Literal' && typeof it.value === 'number';
        if (node.type === 'MemberExpression' && node.computed && isNumber(node.property)) return { target: node.object, index: node.property.value };
        if (
            node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed &&
            node.callee.property.name === 'at' && node.arguments.length === 1 && isNumber(node.arguments[0])
        ) {
            return { target: node.callee.object, index: node.arguments[0].value };
        }
        return undefined;
    }

    private readsBinding(statements: any[], name: string): boolean {
        for (const statement of statements) {
            const redeclared = this.singleDeclarator(statement);
            if (redeclared?.id.name === name) return this.readsName(redeclared.init, name);
            if (this.readsName(statement, name)) return true;
        }
        return false;
    }

    private readsName(node: any, name: string): boolean {
        if (!node) return false;
        if (node.type === 'Identifier') return node.name === name;
        if (node.type === 'BlockStatement') return this.readsBinding(node.body, name);
        let found = false;
        forEachChild(node, (child) => {
            found ||= this.readsName(child, name);
        });
        return found;
    }

    // ---- `var` → `let`, as `blockScopeVars` in babel-prepass.ts ----

    private blockScopeVars(root: any) {
        for (const fnScope of this.scopes.filter((scope) => scope.node === scope.fn && this.isInsideOrSelf(scope.fn, root))) {
            for (const binding of [...fnScope.bindings]) {
                if (binding.kind !== 'var' || binding.declarators.length === 0) continue;
                const blocks = binding.declarators.map(({ block }) => block);
                if (!this.keepsMeaningAsLet(fnScope.fn, binding, blocks)) {
                    if (binding.declarators.every(({ declaration }) => declaration.declarations.length === 1 && this.isHoistable(declaration))) unsupported('var to hoist');
                    continue;
                }
                this.splitIntoLets(binding, blocks);
            }
        }
        const converted = new Set<any>();
        for (const binding of this.letsFromVars) for (const { declaration } of binding.declarators) converted.add(declaration);
        for (const declaration of converted) {
            if (declaration.declarations.every((declarator: any) => this.letDeclarators.has(declarator))) this.edits.overwrite(declaration.start, declaration.start + 3, 'let');
        }
    }

    private readonly letsFromVars: Binding[] = [];
    private readonly letDeclarators = new Set<any>();

    private isInsideOrSelf(node: any, root: any) {
        return node === root || this.isInside(node, root);
    }

    private isHoistable(declaration: any): boolean {
        const parent = this.parents.get(declaration);
        return parent?.type === 'BlockStatement' || parent?.type === 'SwitchCase';
    }

    private keepsMeaningAsLet(owner: any, binding: Binding, blocks: any[]): boolean {
        if (blocks.some((block) => block === null)) return false;
        const declarators = binding.declarators.map(({ declarator }) => declarator);
        for (let i = 0; i < declarators.length; i++) {
            for (let j = 0; j < declarators.length; j++) {
                if (i !== j && (blocks[i] === blocks[j] || this.isInside(declarators[j], blocks[i]))) return false;
            }
        }
        const uses = [...binding.reads, ...binding.writes];
        return uses.every(({ node, fn }) =>
            declarators.some((declarator, i) => this.isInside(node, blocks[i]) && (declarator.start <= node.start || fn !== owner)),
        );
    }

    /** One `let` per declaring block, each with the uses inside its block. */
    private splitIntoLets(binding: Binding, blocks: any[]) {
        binding.scope.bindings.splice(binding.scope.bindings.indexOf(binding), 1);
        binding.declarators.forEach((entry, i) => {
            const target = this.scopeOf.get(blocks[i])!;
            const block = blocks[i];
            const split: Binding = {
                name: binding.name,
                kind: 'let',
                scope: target,
                position: entry.declarator.start,
                ids: [entry.declarator.id],
                reads: binding.reads.filter(({ node }) => this.isInside(node, block)),
                writes: binding.writes.filter(({ node }) => this.isInside(node, block)),
                declarators: [entry],
            };
            for (const id of split.ids) this.bindingOf.set(id, split);
            for (const { node } of [...split.reads, ...split.writes]) this.bindingOf.set(node, split);
            target.bindings.push(split);
            this.letsFromVars.push(split);
            this.letDeclarators.add(entry.declarator);
        });
    }

    // ---- unique names, as `uniqueBindingNames` in babel-prepass.ts ----

    private uniqueBindingNames(root: any) {
        const names = new Set<string>();
        const scopes = this.scopes.filter((scope) => this.isInsideOrSelf(scope.node, root)).sort((a, b) => a.node.start - b.node.start);
        for (const scope of scopes) {
            for (const binding of [...scope.bindings].sort((a, b) => (a.kind === 'param' ? -1 : 0) - (b.kind === 'param' ? -1 : 0) || a.position - b.position)) {
                if (names.has(binding.name)) binding.finalName = this.uid(binding.name);
                else names.add(binding.name);
            }
        }
    }

    private isTaken(name: string): boolean {
        return this.generated.has(name) || new RegExp(`(?<![\\w$])${name.replaceAll('$', '\\$')}(?![\\w$])`).test(this.code);
    }

    /** Babel's `generateUid`: `_name`, then `_name2`, `_name3`, … that no identifier of the module uses. */
    private uid(name: string): string {
        const base = name.replace(/^_+/, '').replace(/\d+$/, '');
        for (let i = 1; ; i++) {
            const candidate = `_${base}${i > 1 ? i : ''}`;
            if (!this.isTaken(candidate)) {
                this.generated.add(candidate);
                return candidate;
            }
        }
    }

    // ---- module names the compiler would take for hooks or components ----

    /**
     * Kotlin's `useFoo$lambda$0` / `Foo$lambda$0` helpers and production `useFoo$ref` imports: compiled functions read
     * them through `_`-prefixed module aliases, as the Babel pre-pass renames them.
     */
    private aliasModuleNames(roots: any[]) {
        const moduleNames = new Set(this.imports.keys());
        for (const statement of this.program.body) {
            const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
            if (declaration?.type === 'FunctionDeclaration' || declaration?.type === 'ClassDeclaration') moduleNames.add(declaration.id.name);
            if (declaration?.type === 'VariableDeclaration') for (const { id } of declaration.declarations) if (id.type === 'Identifier') moduleNames.add(id.name);
        }
        const helpers = new Set<string>();
        for (const statement of this.program.body) {
            if (statement.type === 'FunctionDeclaration' && SYNTHETIC_HELPER.test(statement.id.name) && !moduleNames.has(`_${statement.id.name}`)) helpers.add(statement.id.name);
        }
        const refImports = new Set<string>();
        for (const [local, { imported }] of this.imports) {
            if (SYNTHETIC_REF_IMPORT.test(local) || SYNTHETIC_REF_IMPORT.test(imported)) refImports.add(local);
        }
        if (helpers.size === 0 && refImports.size === 0) return;
        const aliases = new Map<string, string>();
        const visit = (node: any) => {
            if (node.type === 'Identifier' && (helpers.has(node.name) || refImports.has(node.name)) && !this.bindingOf.get(node) && this.isModuleReference(node)) {
                let alias = aliases.get(node.name);
                if (!alias) {
                    alias = helpers.has(node.name) ? `_${node.name}` : this.uid(node.name);
                    this.generated.add(alias);
                    aliases.set(node.name, alias);
                }
                if (!this.isRemoved(node.start)) this.edits.overwrite(node.start, node.end, alias);
            }
            forEachChild(node, visit);
        };
        for (const root of roots) visit(root);
        for (const [name, alias] of aliases) {
            const anchor = refImports.has(name) ? this.imports.get(name)!.declaration.end : this.lastImportEnd();
            this.edits.appendLeft(anchor, `\n${refImports.has(name) ? 'let' : 'const'} ${alias} = ${name};`);
        }
    }

    private isModuleReference(id: any): boolean {
        const parent = this.parents.get(id);
        const key = this.keys.get(id);
        if (!parent) return false;
        if (parent.type === 'MemberExpression' && key === 'property' && !parent.computed) return false;
        if (parent.type === 'Property' && key === 'key' && !parent.computed) return false;
        if ((parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') && key === 'label') return false;
        return !(FUNCTIONS.has(parent.type) && key === 'id');
    }

    private lastImportEnd(): number {
        let end = 0;
        for (const statement of this.program.body) if (statement.type === 'ImportDeclaration') end = statement.end;
        return end;
    }

    // ---- edits ----

    private emitRenames() {
        for (const scope of this.scopes) {
            for (const binding of scope.bindings) {
                if (!binding.finalName) continue;
                for (const node of [...binding.ids, ...binding.reads.map((use) => use.node), ...binding.writes.map((use) => use.node)]) {
                    if (this.regenerated.has(node) || this.isRemoved(node.start)) continue;
                    this.edits.overwrite(node.start, node.end, binding.finalName);
                }
            }
        }
        for (const { at, ref, props } of this.refDeclarations) this.edits.appendLeft(at, ` let { ref: ${ref} } = ${props.finalName ?? props.name};`);
        for (const { statement, bindings } of this.destructurings) {
            const names = bindings.map((binding) => binding.finalName ?? binding.name).join(', ');
            this.edits.overwrite(statement.start, statement.declarations[0].id.end, `let [${names}]`);
        }
    }

    private remove(start: number, end: number) {
        this.edits.remove(start, end);
        this.removed.push([start, end]);
    }

    private isRemoved(offset: number): boolean {
        return this.removed.some(([start, end]) => offset >= start && offset < end);
    }

    private forEachFunction(root: any, visit: (fn: any) => void) {
        const walk = (node: any) => {
            if (FUNCTIONS.has(node.type)) visit(node);
            forEachChild(node, walk);
        };
        walk(root);
    }
}

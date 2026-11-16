// Babel is resolved from the Kotlin/JS project at runtime and ships no types here, so its paths and nodes are `any`.
const COMPONENT_NAME = /^[A-Z]/;
const SYNTHETIC_REF_IMPORT = /\$ref(?:[a-z0-9]{8,16})?$/;
// Kotlin names lambdas `useFoo$...` / `Component$lambda$...`; the compiler would mistake them for hooks/components.
const SYNTHETIC_HELPER = /^(?:use[A-Z0-9]\w*|[A-Z]\w*\$lambda)\$/;
const MEMO_DIRECTIVES = new Set(['use memo', 'use no memo']);
const STATE_HOOKS = new Set(['useState', 'useTransition']);

/**
 * Rewrites the JavaScript Kotlin/JS emits into code `babel-plugin-react-compiler` accepts. Kotlin semantics
 * (hook callbacks, callable references, delegates, effect returns) are lowered by kotlin-react-compiler in IR;
 * what is left here are JavaScript codegen artifacts. It runs in `pre`, so the compiler sees its result in the same pass.
 */
export function babelPrepass({ types: t }: { types: any }) {
    return {
        pre(file: { path: any }) {
            const program = file.path;
            hoistMemoDirectives(program, t);
            renameSyntheticHelpers(program);
            program.traverse({
                // The compiler has no lowering for BigInt literals (Kotlin `Long`); the string keeps 64-bit precision.
                BigIntLiteral: (path: any) => void path.replaceWith(t.callExpression(t.identifier('BigInt'), [t.stringLiteral(path.node.value)])),
            });
            destructureStateHooks(program, t);
            program.scope.crawl();
            blockScopeVars(program, t);
            program.scope.crawl();
            aliasSyntheticImports(program, t);
            program.traverse({
                Function(fn: any) {
                    rewriteDefaultParams(fn, t);
                    destructurePropsRef(fn, t);
                },
            });
            uniqueBindingNames(program);
        },
    };
}

/**
 * Kotlin/JS emits `_init_properties_<File>_kt()` and default-argument handling at the start of a function,
 * pushing `"use memo"` / `"use no memo"` below them, where they are plain expression statements instead of directives.
 * Both move back, in order: an opt-out follows the `"use memo"` the Kotlin plugin puts before it.
 */
function hoistMemoDirectives(program: any, t: any) {
    program.traverse({
        Function(fn: any) {
            if (!t.isBlockStatement(fn.node.body)) return;
            for (const statement of fn.get('body.body')) {
                const { expression } = statement.node;
                if (!statement.isExpressionStatement() || !t.isStringLiteral(expression) || !MEMO_DIRECTIVES.has(expression.value)) continue;
                fn.node.body.directives.push(t.directive(t.directiveLiteral(expression.value)));
                statement.remove();
            }
        },
    });
}

/** `useFoo$lambda` → `_useFoo$lambda`, for top-level functions only: imported names are `aliasSyntheticImports`'. */
function renameSyntheticHelpers(program: any) {
    for (const [name, binding] of Object.entries<any>(program.scope.bindings)) {
        if (binding.kind === 'hoisted' && SYNTHETIC_HELPER.test(name) && !program.scope.hasBinding(`_${name}`)) {
            program.scope.rename(name, `_${name}`);
        }
    }
}

/**
 * `var t = useState(x); var a = t[0]; var b = t[1];` → `let [a, b] = useState(x);`
 * `var a = useState(x)[0];`                          → `let [a] = useState(x);`
 * Indexed, the setter is not known to be stable, and the compiler cannot preserve a `useCallback` depending on it.
 * Each name must be declared once and used only inside the block, where a `let` means what the `var` did.
 */
function destructureStateHooks(program: any, t: any) {
    const isStateHookCall = (node: any) => t.isCallExpression(node) && importedFromReact(program, node.callee, STATE_HOOKS, t);
    program.traverse({
        BlockStatement(block: any) {
            const owner = block.getFunctionParent();
            if (!owner) return;
            const keepsMeaningAsLet = (name: string) => {
                const binding = owner.scope.getBinding(name);
                return binding?.kind === 'var' &&
                    binding.scope === owner.scope &&
                    binding.constantViolations.length === 0 &&
                    binding.referencePaths.every((use: any) => use.isDescendant(block));
            };
            const statements = block.get('body');
            for (let i = 0; i < statements.length; i++) {
                const head = singleDeclarator(statements[i].node, t);
                if (!head?.init) continue;

                const single = indexedAccess(head.init, t);
                if (single?.index === 0 && isStateHookCall(single.target) && keepsMeaningAsLet(head.id.name)) {
                    head.init = single.target;
                    head.id = t.arrayPattern([head.id]);
                    statements[i].node.kind = 'let';
                    continue;
                }

                if (!isStateHookCall(head.init)) continue;
                const value = singleDeclarator(statements[i + 1]?.node, t);
                const setter = singleDeclarator(statements[i + 2]?.node, t);
                if (
                    readsIndex(value, head.id.name, 0, t) &&
                    readsIndex(setter, head.id.name, 1, t) &&
                    !readsBinding(statements.slice(i + 3).map((path: any) => path.node), head.id.name, t) &&
                    keepsMeaningAsLet(value.id.name) &&
                    keepsMeaningAsLet(setter.id.name)
                ) {
                    head.id = t.arrayPattern([value.id, setter.id]);
                    statements[i].node.kind = 'let';
                    statements[i + 1].remove();
                    statements[i + 2].remove();
                    i += 2;
                }
            }
        },
    });
}

function importedFromReact(program: any, callee: any, names: Set<string>, t: any): boolean {
    const binding = t.isIdentifier(callee) ? program.scope.getBinding(callee.name) : undefined;
    const specifier = binding?.kind === 'module' ? binding.path : undefined;
    if (!specifier?.isImportSpecifier() || specifier.parent.source.value !== 'react') return false;
    const { imported } = specifier.node;
    return names.has(t.isIdentifier(imported) ? imported.name : imported.value);
}

/** The declarator of `var <identifier> = ...` with exactly one binding. */
function singleDeclarator(statement: any, t: any) {
    return t.isVariableDeclaration(statement) && statement.declarations.length === 1 && t.isIdentifier(statement.declarations[0].id)
        ? statement.declarations[0]
        : undefined;
}

/** Whether `declarator` is `... = <name>[index]` or `... = <name>.at(index)`. */
function readsIndex(declarator: any, name: string, index: number, t: any): boolean {
    const access = declarator?.init ? indexedAccess(declarator.init, t) : undefined;
    return access?.index === index && t.isIdentifier(access.target, { name });
}

/** Matches `target[n]` and `target.at(n)` with a numeric literal `n`. */
function indexedAccess(node: any, t: any): { target: any; index: number } | undefined {
    if (t.isMemberExpression(node, { computed: true }) && t.isNumericLiteral(node.property)) {
        return { target: node.object, index: node.property.value };
    }
    if (
        t.isCallExpression(node) &&
        t.isMemberExpression(node.callee, { computed: false }) &&
        t.isIdentifier(node.callee.property, { name: 'at' }) &&
        node.arguments.length === 1 &&
        t.isNumericLiteral(node.arguments[0])
    ) {
        return { target: node.callee.object, index: node.arguments[0].value };
    }
    return undefined;
}

/**
 * Whether `statements` read the tuple `name` declared just before them. Kotlin reuses temporary names
 * (`_destruct__k2r9zo`): reads after a redeclaration, at this level or in a nested block, are of the new value.
 */
function readsBinding(statements: any[], name: string, t: any): boolean {
    for (const statement of statements) {
        const redeclared = singleDeclarator(statement, t);
        if (redeclared?.id.name === name) return readsName(redeclared.init, name, t);
        if (readsName(statement, name, t)) return true;
    }
    return false;
}

function readsName(node: any, name: string, t: any): boolean {
    if (!node) return false;
    if (t.isIdentifier(node)) return node.name === name;
    if (t.isBlockStatement(node)) return readsBinding(node.body, name, t);
    return (t.VISITOR_KEYS[node.type] ?? []).some((key: string) => [node[key]].flat().some((child) => readsName(child, name, t)));
}

/**
 * The compiler does not support `var`, which Kotlin/JS declares every local with. `let` is block-scoped, so a `var`
 * becomes a `let` only where that keeps its meaning: one declaration per block, read only inside that block and after
 * it. Otherwise (`do { var item = ...; } while (item !== last)`, a redeclaration in a nested block) its declarations
 * become assignments to one `let` at the top of the function, which is exactly `var` scoping. Shapes neither rewrite
 * covers stay `var`, so the compiler bails out on that function instead of compiling different code.
 *
 * Module-level `var`s stay as they are: the compiler never lowers them, and another module of an import cycle may
 * call into this one before it is evaluated, which a `var` survives (`undefined`) and a `let` does not (TDZ error).
 *
 * Delete once the plugin requires Kotlin 2.5.20, which emits `let` / `const` itself (KT-64348).
 */
function blockScopeVars(program: any, t: any) {
    const declaratorsByOwner = new Map<any, Map<string, any[]>>();
    const patternDeclarations = new Set<any>();
    program.traverse({
        VariableDeclaration(declaration: any) {
            const owner = declaration.getFunctionParent()?.node;
            if (declaration.node.kind !== 'var' || !owner) return;
            for (const declarator of declaration.get('declarations')) {
                if (!declarator.get('id').isIdentifier()) {
                    patternDeclarations.add(declaration.node);
                    continue;
                }
                const byName = declaratorsByOwner.get(owner) ?? new Map<string, any[]>();
                declaratorsByOwner.set(owner, byName);
                const name = declarator.node.id.name;
                byName.set(name, [...(byName.get(name) ?? []), declarator]);
            }
        },
    });

    // Decide everything before rewriting: replacing statements would leave Babel's reference paths stale.
    const asLet = new Set<any>();
    const hoists: Array<{ owner: any; name: string; declarators: any[] }> = [];
    for (const byName of declaratorsByOwner.values()) {
        for (const [name, declarators] of byName) {
            const owner = declarators[0].getFunctionParent();
            if (owner.scope.getBinding(name)?.kind !== 'var') continue;
            if (keepsMeaningAsLet(owner, name, declarators)) {
                for (const declarator of declarators) asLet.add(declarator.node);
            } else if (declarators.every((declarator) => isHoistable(declarator.parentPath))) {
                hoists.push({ owner, name, declarators });
            }
        }
    }

    program.traverse({
        VariableDeclaration(declaration: any) {
            const { node } = declaration;
            if (node.kind === 'var' && !patternDeclarations.has(node) && node.declarations.every((d: any) => asLet.has(d))) {
                node.kind = 'let';
            }
        },
    });
    for (const { owner, name, declarators } of hoists) {
        for (const declarator of declarators) {
            const { init } = declarator.node;
            if (init) declarator.parentPath.replaceWith(t.expressionStatement(t.assignmentExpression('=', t.identifier(name), init)));
            else declarator.parentPath.remove();
        }
        owner.get('body').unshiftContainer('body', t.variableDeclaration('let', [t.variableDeclarator(t.identifier(name))]));
    }
}

/** The node a `let` replacing this `var` declaration would be scoped to, or `null` where `let` is not allowed. */
function letScopeOf(declaration: any): any {
    const parent = declaration.parentPath;
    if (parent.isBlockStatement()) return parent.node;
    if (parent.isSwitchCase()) return parent.parentPath.node;
    if ((parent.isForStatement() && declaration.key === 'init') || (parent.isForXStatement() && declaration.key === 'left')) {
        return parent.node;
    }
    return null;
}

/** Whether every declaration of `name` sits alone in its own block and every use of it is inside one, after it. */
function keepsMeaningAsLet(owner: any, name: string, declarators: any[]): boolean {
    const blocks = declarators.map((declarator) => letScopeOf(declarator.parentPath));
    if (blocks.some((block) => block === null)) return false;
    const inside = (path: any, block: any) => path.findParent((parent: any) => parent.node === block) !== null;
    for (let i = 0; i < declarators.length; i++) {
        for (let j = 0; j < declarators.length; j++) {
            if (i !== j && (blocks[i] === blocks[j] || inside(declarators[j], blocks[i]))) return false;
        }
    }
    const binding = owner.scope.getBinding(name);
    const declaratorNodes = new Set(declarators.map((declarator) => declarator.node));
    const uses = [...binding.referencePaths, ...binding.constantViolations.filter((path: any) => !declaratorNodes.has(path.node))];
    return uses.every((use: any) =>
        declarators.some((declarator, i) =>
            inside(use, blocks[i]) && (declarator.node.start <= use.node.start || use.getFunctionParent().node !== owner.node),
        ),
    );
}

/** A single-declarator `var` statement in a block, which an assignment can replace. */
function isHoistable(declaration: any): boolean {
    const parent = declaration.parentPath;
    return declaration.node.declarations.length === 1 && (parent.isBlockStatement() || parent.isSwitchCase());
}

/**
 * Production Kotlin/JS deduplicates callable-reference `$ref` helpers into the target's module and imports them
 * (`import { useFoo$ref<hash> as useFoo$ref }`). Because `babel-plugin-react-compiler` treats any `ImportSpecifier`
 * whose exported or local name starts with `use` as a hook, references to those helpers are routed through a
 * `_`-prefixed module-local variable. Lifted `$slambda` helpers are intentionally excluded: they can be classes,
 * and eagerly aliasing an imported class could read it during a module cycle before initialization.
 */
function aliasSyntheticImports(program: any, t: any) {
    for (const statement of program.get('body')) {
        if (!statement.isImportDeclaration()) continue;
        for (const specifier of statement.get('specifiers')) {
            if (!specifier.isImportSpecifier()) continue;
            const local = specifier.node.local.name;
            const imported = t.isIdentifier(specifier.node.imported)
                ? specifier.node.imported.name
                : specifier.node.imported.value;
            if (!SYNTHETIC_REF_IMPORT.test(local) && !SYNTHETIC_REF_IMPORT.test(imported)) continue;
            const binding = program.scope.getBinding(local);
            if (!binding || binding.referencePaths.length === 0) continue;
            const alias = program.scope.generateUidIdentifier(local);
            for (const reference of [...binding.referencePaths]) {
                reference.replaceWith(t.cloneNode(alias));
            }
            const [declaration] = statement.insertAfter(t.variableDeclaration('let', [
                t.variableDeclarator(alias, t.identifier(local)),
            ]));
            program.scope.registerDeclaration(declaration);
        }
    }
}

/**
 * Kotlin default arguments reassign the parameter, which the compiler rejects in hooks ("This value cannot be modified"):
 * `x = x === VOID ? d : x;` / `if (x === VOID) { x = d; }` → `let x = _x === VOID ? d : _x;`, the parameter renamed to `_x`.
 */
function rewriteDefaultParams(fn: any, t: any) {
    if (!t.isBlockStatement(fn.node.body)) return;
    let rewritten = false;
    for (const statement of fn.get('body.body')) {
        if (isInitPropertiesCall(statement.node, t) || isBareDeclaration(statement.node, t)) continue;
        const guard = voidGuard(statement.node, t);
        const index = guard ? fn.node.params.findIndex((param: any) => t.isIdentifier(param, { name: guard.name })) : -1;
        if (!guard || index < 0) break;
        const raw = fn.scope.generateUidIdentifier(guard.name);
        fn.get(`params.${index}`).replaceWith(raw);
        const isVoid = t.binaryExpression('===', t.cloneNode(raw), t.identifier('VOID'));
        statement.replaceWith(t.variableDeclaration('let', [
            t.variableDeclarator(t.identifier(guard.name), t.conditionalExpression(isVoid, guard.value, t.cloneNode(raw))),
        ]));
        rewritten = true;
    }
    if (rewritten) fn.scope.crawl();
}

function isInitPropertiesCall(statement: any, t: any): boolean {
    return t.isExpressionStatement(statement) &&
        t.isCallExpression(statement.expression) &&
        t.isIdentifier(statement.expression.callee) &&
        statement.expression.callee.name.startsWith('_init_properties_');
}

/** `let x;`, which `blockScopeVars` puts at the top of a function, above its default-argument handling. */
function isBareDeclaration(statement: any, t: any): boolean {
    return t.isVariableDeclaration(statement) && statement.declarations.every((declarator: any) => !declarator.init);
}

/** `x = x === VOID ? d : x;` or `if (x === VOID) { x = d; }` → `{ name: 'x', value: d }`. */
function voidGuard(statement: any, t: any): { name: string; value: any } | undefined {
    const assignmentIn = (node: any) =>
        t.isExpressionStatement(node) && t.isAssignmentExpression(node.expression, { operator: '=' }) && t.isIdentifier(node.expression.left)
            ? node.expression
            : undefined;
    const isVoidTest = (test: any, name: string) =>
        t.isBinaryExpression(test, { operator: '===' }) && t.isIdentifier(test.left, { name }) && t.isIdentifier(test.right, { name: 'VOID' });

    let guard: { name: string; value: any } | undefined;
    const assignment = assignmentIn(statement);
    if (assignment) {
        const { left, right } = assignment;
        if (t.isConditionalExpression(right) && isVoidTest(right.test, left.name) && t.isIdentifier(right.alternate, { name: left.name })) {
            guard = { name: left.name, value: right.consequent };
        }
    } else if (t.isIfStatement(statement) && !statement.alternate) {
        const body = t.isBlockStatement(statement.consequent) ? statement.consequent.body : [statement.consequent];
        const inner = body.length === 1 ? assignmentIn(body[0]) : undefined;
        if (inner && isVoidTest(statement.test, inner.left.name)) guard = { name: inner.left.name, value: inner.right };
    }
    // A default reading its own parameter would read the new `let` before initialization.
    return guard && !mentions(guard.value, guard.name, t) ? guard : undefined;
}

/** Whether any identifier in `node` is named `name`, property keys included. */
function mentions(node: any, name: string, t: any): boolean {
    let found = false;
    t.traverseFast(node, (child: any) => {
        if (t.isIdentifier(child, { name })) found = true;
    });
    return found;
}

/**
 * In a `"use memo"` component, `props.ref` → a `let { ref: _ref } = props` local: the compiler rejects the property
 * load as a ref access during render (e.g. when the ref is passed to a hook), but accepts the destructured value.
 */
function destructurePropsRef(fn: any, t: any) {
    const [props] = fn.node.params;
    if (fn.node.params.length !== 1 || !t.isIdentifier(props)) return;
    if (!fn.node.body.directives?.some((directive: any) => directive.value.value === 'use memo')) return;
    const name = fn.node.id?.name ?? (fn.parentPath.isVariableDeclarator() ? fn.parent.id.name : undefined);
    if (name && !COMPONENT_NAME.test(name)) return;

    const binding = fn.scope.getBinding(props.name);
    const reads = binding.constantViolations.length === 0 ? propsRefReads(binding, t) : [];
    if (reads.length === 0) return;

    const ref = fn.scope.generateUidIdentifier('ref');
    for (const read of reads) read.replaceWith(t.cloneNode(ref));
    const [declaration] = fn.get('body').unshiftContainer('body', t.variableDeclaration('let', [
        t.variableDeclarator(t.objectPattern([t.objectProperty(t.identifier('ref'), ref)]), t.identifier(props.name)),
    ]));
    fn.scope.registerDeclaration(declaration);
}

/** The `props.ref` reads, or none when `props` is null-checked or `props.ref` is written: rewriting those isn't safe. */
function propsRefReads(binding: any, t: any): any[] {
    const reads = [];
    for (const use of binding.referencePaths) {
        const parent = use.parentPath;
        if (
            parent.isOptionalMemberExpression() ||
            parent.isUnaryExpression() ||
            parent.isBinaryExpression() ||
            parent.isLogicalExpression() ||
            parent.node.test === use.node
        ) {
            return [];
        }
        if (!parent.isMemberExpression({ object: use.node, computed: false }) || !t.isIdentifier(parent.node.property, { name: 'ref' })) continue;
        const context = parent.parentPath;
        if (context.isAssignmentExpression({ left: parent.node }) || context.isUpdateExpression() || context.isUnaryExpression({ operator: 'delete' })) {
            return [];
        }
        reads.push(parent);
    }
    return reads;
}

/**
 * Renames repeated binding names inside each top-level function so no two of its bindings share a name.
 * For a shadowed name the compiler renames the later binding to `<name>_<n>` without checking that this name is free
 * (`HIRBuilder.resolveBinding`), while Kotlin/JS names its temporaries exactly that way (`tmp`, `tmp_0`): a bail-out
 * then leaves two `let tmp_0` declarations behind, and a successful compile silently merges two variables into one.
 */
function uniqueBindingNames(program: any) {
    program.traverse({
        Function(fn: any) {
            const scopes = new Set([fn.scope]);
            fn.traverse({ Scopable: (path: any) => void scopes.add(path.scope) });
            const names = new Set<string>();
            for (const scope of scopes) {
                for (const name of Object.keys(scope.bindings)) {
                    if (names.has(name)) scope.rename(name);
                    else names.add(name);
                }
            }
            fn.skip();
        },
    });
}

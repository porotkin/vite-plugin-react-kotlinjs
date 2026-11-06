// Babel is resolved from the Kotlin/JS project at runtime and ships no types here, so its paths and nodes are `any`.
const COMPONENT_NAME = /^[A-Z]/;

/**
 * Babel pre-pass for the Kotlin/JS rewrites that need scope analysis; `normalize.ts` does the textual ones.
 * It runs in `pre`, so `babel-plugin-react-compiler` sees its result in the same Babel pass.
 */
export function babelPrepass({ types: t }: { types: any }) {
    return {
        pre(file: { path: any }) {
            file.path.traverse({
                Function(fn: any) {
                    rewriteDefaultParams(fn, t);
                    destructurePropsRef(fn, t);
                },
            });
            uniqueBindingNames(file.path);
        },
    };
}

/**
 * Kotlin default arguments reassign the parameter, which the compiler rejects in hooks ("This value cannot be modified"):
 * `x = x === VOID ? d : x;` / `if (x === VOID) { x = d; }` → `let x = _x === VOID ? d : _x;`, the parameter renamed to `_x`.
 */
function rewriteDefaultParams(fn: any, t: any) {
    if (!t.isBlockStatement(fn.node.body)) return;
    let rewritten = false;
    for (const statement of fn.get('body.body')) {
        if (isInitPropertiesCall(statement.node, t)) continue;
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

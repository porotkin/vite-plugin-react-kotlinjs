// Babel is resolved from the Kotlin/JS project at runtime and ships no types here, so its paths and nodes are `any`.

/**
 * Babel pre-pass for the Kotlin/JS rewrites that need scope analysis; `normalize.ts` does the textual ones.
 * It runs in `pre`, so `babel-plugin-react-compiler` sees its result in the same Babel pass.
 */
export function babelPrepass() {
    return {
        pre(file: { path: any }) {
            uniqueBindingNames(file.path);
        },
    };
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

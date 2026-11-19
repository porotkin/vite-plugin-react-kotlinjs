# How it works

`reactKotlinJs()` returns two Vite plugins that run, in this order, before `@vitejs/plugin-react`:

1. [Fast Refresh](#fast-refresh) (`vite:react-plugin-kotlinjs`, `serve` only)
2. [React Compiler pre-transform](#react-compiler-pre-transform) (`kotlin-react-compiler`)

Fast Refresh goes first, on the module as Kotlin/JS emitted it, so `isReactFC` / `getComponentName` match that text
rather than the compiler's output.

## Why `@vitejs/plugin-react` is not enough

- Kotlin/JS generates named exports for components, which makes it impossible to use the default export.
- The standard React Refresh Babel plugin does not recognize the generated component variable that actually returns
  the React node.
- React Compiler rejects or misreads several shapes Kotlin/JS code generation emits (see the [pre-pass](#the-pre-pass)).

## Fast Refresh

The plugin rewrites React modules so that the official Vite React plugin can apply React Fast Refresh:

- the exported component getter is renamed so React Refresh registers it as a component (the export name stays
  `get_X`)

  ```js
  // before
  function get_X() { /* ... */ }

  // after
  function GetX() { /* ... */ }
  ```

- a `react/jsx-dev-runtime` marker is appended, since `@vitejs/plugin-react` only injects Fast Refresh into modules
  that mention it

Fast Refresh treats a module as one component, hence the `kotlin.js.ir.output.granularity=per-file` requirement.

## React Compiler pre-transform

The [kotlin-react-compiler](https://github.com/porotkin/kotlin-react-compiler) Gradle plugin prepares the Kotlin side:
it lowers `kotlin-react` components and hooks into shapes the compiler understands, emits hook callbacks inline, and
lowers callable references, ref and state delegates and effect returns in IR. This plugin only rewrites what is left of
Kotlin/JS code generation.

Modules that opt in with `"use memo"` (or every React module, unless `compilationMode` is `'annotation'`) are compiled
in one Babel pass: a pre-pass rewrites what Kotlin/JS code generation emits into what the compiler accepts, then
`babel-plugin-react-compiler` runs with a custom `environment.moduleTypeProvider` that tells it:

- `jsx()` / `jsxs()` from `react/jsx-runtime` and kotlin-react's JSX runtime return frozen values;
- kotlin-react-compiler's `mutableValue()`, through which it reads a DOM node, ref or signal an effect writes to,
  returns a value from outside React: the write compiles in the effect and is still rejected during render.

Because this `moduleTypeProvider` replaces the compiler's built-in one, the plugin keeps a copy of the libraries
`babel-plugin-react-compiler` knows as incompatible (the `watch()` of `react-hook-form`'s `useForm()`, `useReactTable`
of `@tanstack/react-table`, `useVirtualizer` of `@tanstack/react-virtual`); `incompatibleHooks` adds to them.

### The pre-pass

- moves `"use memo"` / `"use no memo"` back above Kotlin's `_init_properties_*()` call and default-argument handling,
  both of them when a function opts out

  ```js
  // before
  _init_properties_X_kt();
  'use memo';
  'use no memo';

  // after
  'use memo';
  'use no memo';
  _init_properties_X_kt();
  ```

- prefixes synthetic `use*$lambda` / `Component$lambda$` helpers with `_`, so they aren't mistaken for hooks or
  components

- rewrites `BigInt` literals (Kotlin `Long`) to `BigInt('1000')`, which the compiler can lower

- destructures indexed `useState` / `useTransition` results, so the compiler knows the setter is stable

  ```js
  // before
  var t = useState(0);
  var a = t[0];
  var b = t[1];

  // after
  let [a, b] = useState(0);
  ```

- `var` → `let` inside functions, only where block scoping keeps the meaning; otherwise one `let` at the top of the
  function, or the `var` stays and the compiler skips that function. Module-level `var`s are left alone: a module of an
  import cycle may be called before it is evaluated. (Kotlin/JS emits `let` / `const` itself starting with Kotlin
  2.5.20, see [KT-64348](https://youtrack.jetbrains.com/issue/KT-64348); this rewrite goes then.)

- imported `$ref` helpers (production Kotlin/JS moves callable-reference helpers into the target's module) → a
  `_`-prefixed module-level alias, since the compiler treats any import named `use*` as a hook

  ```js
  // before
  import { useFoo$ref1a2b3c4d as useFoo$ref } from './Foo.mjs';
  useFoo$ref();

  // after
  import { useFoo$ref1a2b3c4d as useFoo$ref } from './Foo.mjs';
  let _useFoo$ref = useFoo$ref;
  _useFoo$ref();
  ```

- Kotlin default arguments → `let` locals, since the compiler rejects reassigned hook parameters

  ```js
  // before
  function useFoo(x) {
    x = x === VOID ? d : x;
  }

  // after
  function useFoo(_x) {
    let x = _x === VOID ? d : _x;
  }
  ```

- `props.ref` in `"use memo"` components → a destructured local, since the compiler rejects the property load as a ref
  access during render

  ```js
  // before
  f(props.ref);

  // after
  let { ref: _ref } = props;
  f(_ref);
  ```

- repeated binding names inside each top-level function are renamed apart: the compiler renames a shadowed `tmp` to
  `tmp_0` without checking that the name is free, which collides with Kotlin's own `tmp_0` temporaries

  ```js
  // before
  let tmp = a;
  if (c) {
    let tmp = b;
  }

  // after
  let tmp = a;
  if (c) {
    let _tmp = b;
  }
  ```

- for kotlin-react-compiler after 1.0.8, which avoids `js()` calls (the Kotlin compiler parses each one, which made
  modules with many elements slow to compile): turns `__krcUseMemo();` into `"use memo";` and, inside compiled
  functions, the `Object()` props objects start with into `{}`, which the compiler memoizes as a value it creates

The pre-pass touches only the functions the compiler compiles: in `annotation` mode, the outermost function of each
module statement whose source has a memo directive (about a third of a Kotlin/JS module); the rest of the module stays
as Kotlin/JS emitted it.

### The oxc backend

`backend: 'oxc'` compiles with the experimental Rust port of React Compiler from `oxc-transform-react`. In `annotation`
mode the pre-pass runs as text edits on oxc's own AST, without Babel, whose parse, scope crawls and code generation cost
more than the compiler. A module it doesn't cover (a `var` that has to move, BigInt, a class, a pattern) goes through
the Babel pre-pass, on a worker of its own, so that only one worker loads Babel.

The native binding takes no callbacks, so the plugin works around them:

- **No `moduleTypeProvider`:** instead of typing `jsx()` / `jsxs()`, the pre-pass turns each call inside a compiled
  function into a JSX element carrying its arguments (`<Jsx a0={type} a1={props} a2={key} />`, `Jsx` being a second
  import of the same function), which the compiler memoizes as JSX; a virtual `jsx-runtime` calls the original function
  with them again. Calls elsewhere stay as they are.
- **`incompatibleHooks`:** a function calling a listed hook is opted out with `"use no memo"` and reported as an
  `IncompatibleLibrary` `CompileError`.
- **`logger`:** diagnostics are turned into `CompileError` events naming the function they leave uncompiled (`fnName`,
  `fnLoc`), with the diagnostic's own `detail.loc` and `detail.severity`, and `detail.category` derived from the reason
  (`PreserveManualMemo`, `IncompatibleLibrary`, otherwise `Unknown`). oxc reports some bail-outs, such as an
  incompatible library, as warnings, so the severity doesn't tell whether the function compiled.
- **`mutableValue()`:** a module calling it is compiled with `babel-plugin-react-compiler`, since only its
  `moduleTypeProvider` types the value so that a write through it is still rejected during render.
- **Miscompiled `useMemo`:** `oxc-transform-react` 0.158 compiles a `useMemo` callback that constructs a class it
  computes there, such as Kotlin's `new (PointD())(x * 0.5 + 2)`, into a memo block that checks a value it only declares
  inside: `if ($[0] !== t1) { const t1 = x * 0.5 + 2; … }`, which throws when rendered. A module calling `useMemo` whose
  output has such a block is compiled with `babel-plugin-react-compiler` instead.
- **Off:** `validateExhaustiveMemoizationDependencies` and `validateExhaustiveEffectDependencies`, which
  `babel-plugin-react-compiler` 1.0 doesn't have either.

### Source maps

The compiled module carries a source map back to the Kotlin/JS output, which Vite chains with the Kotlin one. Maps are
made only where something reads them: on the dev server, and in builds whose `build.sourcemap` is set.

### Workers and cache

Modules compile on worker threads (a quarter of the cores, at most 4), as Vite transforms many modules at once. The
results are kept in Vite's `cacheDir` (`node_modules/.vite/vite-plugin-react-kotlinjs`), appended by each worker to a
pack file of its own (a file per module spent a quarter of the compile time creating files), and reused while the
module's code, the options, the plugin and the Babel, React Compiler and oxc versions stay the same.

On a project with 4,600 compiled modules (oxc backend), the production Vite step takes 2.0 s with the cache and 2.3 s
without it, against 1.85 s without the compiler; the first dev page load takes 3.8–4.0 s.

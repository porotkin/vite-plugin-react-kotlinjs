# Vite Plugin React KotlinJS

A Vite plugin that enables Fast Refresh and React Compiler support for Kotlin/JS React applications by pre/post-processing generated `.mjs` files.

## Installation

Add the following dependency to your `build.gradle.kts`:
```kotlin
dependencies {
  jsMainImplementation(devNpm("@porotkin/vite-plugin-react-kotlinjs", "^2.0.1"))
}
```

> Source set can be changed to suit your needs (e.g. `webMainImplementation` instead)

For React Compiler support, also add `@babel/core` and `babel-plugin-react-compiler`:
```kotlin
dependencies {
    jsMainImplementation(devNpm("@babel/core", "latest"))
    jsMainImplementation(devNpm("babel-plugin-react-compiler", "latest"))
}
```

## Usage

Add the plugin (it returns both plugins: React Compiler, then Fast Refresh) and the official Vite React plugin to your `vite.config.js`:
```javascript
import reactKotlinJs from '@porotkin/vite-plugin-react-kotlinjs'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
    return {
        plugins: [
            reactKotlinJs({
                reactCompiler: {
                    compilationMode: 'annotation',
                },
            }),
            react(),
        ],
    }
})
```

You can also use the standalone React Compiler pre-plugin or helper functions directly:
```javascript
import {
    kotlinReactCompilerVitePlugin,
    compileKotlinMjs,
    normalizeKotlinMjs,
    moduleTypeProvider,
} from '@porotkin/vite-plugin-react-kotlinjs'
```

## Options

The plugin accepts the following options:

### `reactCompiler`

- **Type:** `boolean | ReactCompilerOptions`

Enable/disable or configure the React Compiler pre-transform (`{ compilationMode?: 'annotation' | 'infer' | 'syntax' | 'all', preserveExistingMemoizationGuarantees?: boolean, incompatibleHooks?: Record<string, string[]>, include?: Array<string | RegExp> }`).

### `compilationMode`

- **Type:** `'annotation' | 'infer' | 'syntax' | 'all'`
- **Default:** `'annotation'`

React Compiler compilation mode when transforming Kotlin/JS `.mjs` modules.

### `preserveExistingMemoizationGuarantees`

- **Type:** `boolean`
- **Default:** `true`

Controls `enablePreserveExistingMemoizationGuarantees` and `validatePreserveExistingMemoizationGuarantees` in `babel-plugin-react-compiler` (enabled by default there too). When `true`, a `useMemo` / `useCallback` result stays memoized, and a function whose existing memoization the compiler cannot preserve is left uncompiled. When `false`, more functions compile, but the compiler may drop a `useMemo` and recompute its value on every render: code that relies on the value keeping its identity, such as effect dependencies or options passed to TanStack Table, then sees a new value each render and can loop. Kotlin/JS `useMemo` / `useCallback` calls lack `exhaustive-deps` lint enforcement and often omit stable custom hook results, which is what most of the uncompiled functions come from.

### `incompatibleHooks`

- **Type:** `Record<string, string[]>`
- **Default:** `{}`

Hooks, by module name, that the compiler cannot memoize safely, e.g. `{ '@tanstack/react-virtual': ['useVirtualizer'] }`: a function calling one is left uncompiled. The plugin's `moduleTypeProvider` replaces `babel-plugin-react-compiler`'s built-in one, so its list of incompatible libraries does not apply; list the hooks of the library versions you use here.

### `include`

- **Type:** `Array<string | RegExp>`
- **Default:** `[/\.mjs$/]`

Module ID patterns to include for transformation.

### `isReactFC`

- **Type:** `(code: string) => boolean`

Custom function to check if the code is a React functional component.

### `getComponentName`

- **Type:** `(code: string) => string | undefined`

Custom function to extract React component names from the code. Useful if your Kotlin/JS compiler generates different patterns.

### `debug`

- **Type:** `boolean`

Output debug information about the transformed files.

## How it works

1. **React Compiler Pre-Transform:** The `kotlin-react-compiler` plugin compiles modules that opt in with `"use memo"`
   (or every React module, unless `compilationMode` is `'annotation'`). It uses **Oxc** (`parseSync` and `Visitor` from
   `rolldown/utils`) to normalize the Kotlin/JS `.mjs` output:

   - `var` → `let` (Kotlin/JS emits `let` / `const` itself starting with Kotlin 2.5.20,
     see [KT-64348](https://youtrack.jetbrains.com/issue/KT-64348))
   - indexed `useState` / `useTransition` results → array destructuring

     ```js
     // before
     var t = useState(0);
     var a = t[0];
     var b = t[1];

     // after
     let [a, b] = useState(0);
     ```

   - `_` prefix on synthetic `use*$lambda` / `Component$lambda$` helpers, so they aren't mistaken for hooks or
     components

     ```js
     // before
     useFoo$lambda

     // after
     _useFoo$lambda
     ```

   - lifted `useMemo` / `useCallback` / `useEffect` callbacks (also hoisted as `let tmp = () => ...`) → inline arrows

     ```js
     // before
     useMemo(useFoo$lambda, []);

     // after
     useMemo(() => { /* useFoo$lambda body */ }, []);
     ```

   - `$slambda(...)` / `$ref()` callable references passed to hooks → inline arrows

     ```js
     // before
     useMemo(get$ref(), []);

     // after
     useMemo(() => get$ref()(), []);
     ```

   - `getLocalDelegateReference` delegate accessors → direct `.current` reads / writes

     ```js
     // before
     invoke$lambda(x$delegate);

     // after
     x$delegate.current;
     ```

   - `BigInt` literals → `BigInt` string calls

     ```js
     // before
     1000n;

     // after
     BigInt('1000');
     ```

   - trailing `return Unit_getInstance()` dropped from `useEffect` callbacks

     ```js
     // before
     () => {
       f();
       return Unit_getInstance();
     }

     // after
     () => {
       f();
     }
     ```

   - `"use memo"` / `"use no memo"` moved back above Kotlin's `_init_properties_*()` call and default-argument handling

     ```js
     // before
     _init_properties_X_kt();
     'use memo';

     // after
     'use memo';
     _init_properties_X_kt();
     ```

   Then it runs `babel-plugin-react-compiler` with a custom `environment.moduleTypeProvider` that tells the compiler
   `jsx()` / `jsxs()` from `react/jsx-runtime` and kotlin-react's JSX runtime return frozen values. Before the compiler
   runs, a Babel pre-pass applies the rewrites that need scope analysis:

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

    - `props.ref` in `"use memo"` components → a destructured local, since the compiler rejects the property load as a
      ref access during render

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

2. **Fast Refresh Post-Processing (`serve` only):** The `vite:react-plugin-kotlinjs` plugin rewrites React modules so
   the official Vite React plugin can apply React Fast Refresh:

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

## Why `@vitejs/plugin-react` is not enough?

- Kotlin/JS generates named exports for components, which makes it impossible to use the default export.
- Standard React Refresh Babel plugin does not recognize the generated component variable that actually returns the
  React node.
- Your FC lambdas must return a React node!

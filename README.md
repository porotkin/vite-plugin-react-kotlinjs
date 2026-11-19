# Vite Plugin React KotlinJS

Fast Refresh and [React Compiler](https://react.dev/learn/react-compiler) for Kotlin/JS React apps built with Vite.

## Requirements

- Vite 8
- Kotlin/JS with ES modules (`useEsModules()`) and one module per Kotlin file, in `gradle.properties`:
  ```properties
  kotlin.js.ir.output.granularity=per-file
  ```
- For React Compiler: the [kotlin-react-compiler](https://github.com/porotkin/kotlin-react-compiler) Gradle plugin,
  1.0.7 or newer
- Components must return a React node

## Installation

In `build.gradle.kts` (any source set works, e.g. `webMainImplementation`):

```kotlin
dependencies {
  jsMainImplementation(devNpm("@porotkin/vite-plugin-react-kotlinjs", "^2.1.3"))
}
```

For React Compiler, also add Babel and the compiler:

```kotlin
dependencies {
    jsMainImplementation(devNpm("@babel/core", "latest"))
    jsMainImplementation(devNpm("babel-plugin-react-compiler", "latest"))
}
```

## Usage

In `vite.config.js`, add the plugin before the official React plugin:

```javascript
import reactKotlinJs from '@porotkin/vite-plugin-react-kotlinjs'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    reactKotlinJs(),
    react(),
  ],
})
```

Also exported: `kotlinReactCompilerVitePlugin()` (React Compiler without Fast Refresh), `compileKotlinMjs()` and
`moduleTypeProvider`.

## Options

| Option             | Type                                    | Default      | Description                                                                                                        |
|--------------------|-----------------------------------------|--------------|--------------------------------------------------------------------------------------------------------------------|
| `reactCompiler`    | `boolean \| ReactCompilerOptions`       | `true`       | Enables, disables or [configures](#react-compiler-options) React Compiler.                                         |
| `include`          | `Array<string \| RegExp>`               | `[/\.mjs$/]` | Module IDs to transform. `node_modules` is always skipped.                                                         |
| `isReactFC`        | `(code: string) => boolean`             | React import | Detects React modules. Unless `compilationMode` is `'annotation'`, also picks the modules React Compiler compiles. |
| `getComponentName` | `(code: string) => string \| undefined` |              | Extracts the component name, if your Kotlin/JS output uses different patterns.                                     |
| `debug`            | `boolean`                               | `false`      | Logs the transformed files.                                                                                        |

### React Compiler options

| Option                                  | Type                                           | Default        | Description                                                                                                                              |
|-----------------------------------------|------------------------------------------------|----------------|------------------------------------------------------------------------------------------------------------------------------------------|
| `compilationMode`                       | `'annotation' \| 'infer' \| 'syntax' \| 'all'` | `'annotation'` | Which functions get compiled. `'annotation'` means only those marked `"use memo"`.                                                       |
| `backend`                               | `'babel' \| 'oxc'`                             | `'babel'`      | [Compiler implementation](#oxc-backend).                                                                                                 |
| `preserveExistingMemoizationGuarantees` | `boolean`                                      | `true`         | [Keeps `useMemo` / `useCallback` results stable](#preserving-memoization).                                                               |
| `incompatibleHooks`                     | `Record<string, string[]>`                     | `{}`           | Hooks by module, e.g. `{ 'react-use-measure': ['useMeasure'] }`, whose callers stay uncompiled, on top of the ones React Compiler knows. |
| `logger`                                | `{ logEvent(filename, event) }`                |                | [Receives compiler events](#reporting-uncompiled-functions).                                                                             |

#### Preserving memoization

With `true`, a `useMemo` / `useCallback` result keeps its identity, and a function whose memoization the compiler
can't preserve is left uncompiled. With `false`, more functions compile, but the compiler may recompute a memoized
value on every render, so effect dependencies or options passed to libraries such as TanStack Table can change each
render and loop. Most functions left uncompiled come from Kotlin `useMemo` / `useCallback` calls that omit
dependencies, since Kotlin has no `exhaustive-deps` lint.

#### Reporting uncompiled functions

The logger gets `babel-plugin-react-compiler` events per module: `CompileSuccess`, `CompileSkip` (`"use no memo"`) and
`CompileError`. A function with a `CompileError` is not memoized at all and nothing else reports it, so if you rely on
the compiler for stable identities, fail the build on it:

```javascript
reactKotlinJs({
    reactCompiler: {
        logger: {
            logEvent(filename, event) {
                if (event.kind === 'CompileError') {
                    throw new Error(`${filename}:${event.fnLoc?.start.line}: ${event.detail.reason}`)
                }
            },
        },
    },
})
```

#### oxc backend

`'oxc'` uses the experimental Rust port of React Compiler, several times faster than Babel. Install
`oxc-transform-react` next to the plugin. Differences from `'babel'`:

- the logger only receives `CompileError` events, and their `severity` doesn't tell whether the function compiled
- modules calling kotlin-react-compiler's `mutableValue()`, and modules oxc miscompiles (a `useMemo` constructing a
  class read before its arguments are declared), still compile with Babel, so `babel-plugin-react-compiler` is needed
  for them
- exhaustive dependency validation is off, as in `babel-plugin-react-compiler` 1.0

### Good to know

- React Compiler runs only in Vite. Kotlin/JS browser tests (`jsBrowserTest`) run without it, so a hook that promises
  a stable identity should keep its own `useMemo` / `useCallback`.
- Compiled modules are cached in `node_modules/.vite/vite-plugin-react-kotlinjs`.

## How it works

See [HOW_IT_WORKS.md](HOW_IT_WORKS.md) for what the plugin rewrites in Kotlin/JS output and why.

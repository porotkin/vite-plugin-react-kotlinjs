# Vite Plugin React KotlinJS

A Vite plugin that enables Fast Refresh and React Compiler support for Kotlin/JS React applications by pre/post-processing generated `.mjs` files.

## Installation

Add the following dependency to your `build.gradle.kts`:
```kotlin
dependencies {
  jsMainImplementation(devNpm("@porotkin/vite-plugin-react-kotlinjs", "^1.0.6"))
}
```

> Source set can be changed to suit your needs (e.g. `webMainImplementation` instead)

For React Compiler support, also add `@babel/core` and `babel-plugin-react-compiler`:
```kotlin
dependencies {
  jsMainImplementation(devNpm("@babel/core", "^7.26.0"))
  jsMainImplementation(devNpm("babel-plugin-react-compiler", "^1.0.0"))
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

Enable/disable or configure the React Compiler pre-transform (`{ compilationMode?: 'annotation' | 'infer' | 'syntax' | 'all', include?: Array<string | RegExp> }`).

### `compilationMode`

- **Type:** `'annotation' | 'infer' | 'syntax' | 'all'`
- **Default:** `'annotation'`

React Compiler compilation mode when transforming Kotlin/JS `.mjs` modules.

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

1. **React Compiler Pre-Transform:** The `kotlin-react-compiler` plugin uses **Oxc** (`parseSync` and `Visitor` from `rolldown/utils`) to normalize Kotlin/JS `.mjs` syntax (`var` to `let`, indexed `useState` / `useTransition` access to array destructuring, `_` prefixing on synthetic `use*$lambda` / `Component$lambda$` helpers, re-inlining lifted `useMemo` / `useCallback` / `useEffect` callbacks, and stripping trailing `return Unit_getInstance()` from `useEffect`) before running `babel-plugin-react-compiler` with a custom `environment.moduleTypeProvider` for `react/jsx-runtime`.
2. **Fast Refresh Post-Processing (`serve` only):** The `vite:react-plugin-kotlinjs` plugin rewrites exported Kotlin/JS component getters so the official Vite React plugin can apply React Fast Refresh.

## Why `@vitejs/plugin-react` is not enough?

- Kotlin/JS generates named exports for components, which makes it impossible to use the default export.
- Standard React Refresh Babel plugin does not recognize the generated component variable that actually returns the
  React node.
- Your FC lambdas must return a React node!

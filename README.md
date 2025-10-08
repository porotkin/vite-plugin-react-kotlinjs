# Vite Plugin React KotlinJS

A Vite plugin that enables Fast Refresh support for Kotlin/JS React applications. 

This plugin is inspired by the original 
[@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/tree/main) and adapted to work with Kotlin/JS.

## Installation

Add the following dependency to your `build.gradle.kts`:
```kotlin
dependencies {
    jsMainImplementation(devNpm("@porotkin/vite-plugin-react-kotlinjs", "^0.0.3"))
}
```

> Source set can be changed to suit your needs (e.g. `webMain` instead)

## Usage

Add the plugin to your `vite.config.js`:
```javascript
import reactRefresh from '@porotkin/vite-plugin-react-kotlinjs'

export default defineConfig(() => {
    return {
        plugins: [
            reactRefresh(),
        ],
    }
})
```

## Options

The plugin accepts the following options:

### `include`

- **Type:** `string | RegExp | Array<string | RegExp>`
- **Default:** `"**/*.mjs"`

Files to include for processing. By default, all `.mjs` files are included.

### `exclude`

- **Type:** `string | RegExp | Array<string | RegExp>`
- **Default:** `["**/use*.mjs", "**/Main.mjs"]`

Files to exclude from processing. By default, excludes hooks (files starting with `use`) and the main entry point.

### `getComponentName`

- **Type:** `(code: string) => string | undefined`
- **Default:** Extracts component names from Kotlin/JS lambda patterns

Custom function to extract React component names from the code. Useful if your Kotlin/JS compiler generates different patterns.

## How it works

This plugin combines Babel transformation with React Refresh runtime to provide hot module replacement for Kotlin/JS React components, preserving component state during development.

## Why @vitejs/plugin-react-refresh is not enough?

- Kotlin/JS generates named exports for components, which makes it impossible to use the default export.
- Standard React Refresh Babel plugin does not recognize the generated component variable that actually returns the React node. 

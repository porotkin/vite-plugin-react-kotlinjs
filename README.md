# Vite Plugin React KotlinJS

A Vite plugin that enables Fast Refresh support for Kotlin/JS React applications. 

This plugin is inspired by the original 
[@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/tree/main) and adapted to work with Kotlin/JS.

## Installation

Add the following dependency to your `build.gradle.kts`:
```kotlin
dependencies {
    jsMainImplementation(devNpm("@porotkin/vite-plugin-react-kotlinjs", "^1.0.3"))
}
```

> Source set can be changed to suit your needs (e.g. `webMainImplementation` instead)

## Usage

Add the plugin and official Vite React plugin to your `vite.config.js`:
```javascript
import reactRefresh from '@porotkin/vite-plugin-react-kotlinjs'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
    return {
        plugins: [
            reactRefresh(),
            react(),
        ],
    }
})
```

## Options

The plugin accepts the following options:

### `isReactFC`

- **Type:** `(code: string) => boolean`

Custom function to check if the code is a React functional component.

### `getComponentName`

- **Type:** `(code: string) => string | undefined`

Custom function to extract React component names from the code. Useful if your Kotlin/JS compiler generates different patterns.

## How it works

Plugin post-processes generated Kotlin/JS files, so the official Vite React plugin can handle them.

## Why `@vitejs/plugin-react` is not enough?

- Kotlin/JS generates named exports for components, which makes it impossible to use the default export.
- Standard React Refresh Babel plugin does not recognize the generated component variable that actually returns the
  React node.
- Your FC lambdas must return a React node!

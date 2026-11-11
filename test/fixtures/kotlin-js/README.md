# Kotlin/JS output the plugin has to compile

`Sample.development.mjs` and `Sample.production.mjs` are what Kotlin/JS emits for `Sample.kt` in a project that
applies the [kotlin-react-compiler](https://github.com/porotkin/kotlin-react-compiler) Gradle plugin and nothing else
of note. `compile.test.js` expects React Compiler to compile every function in them except the one that opts out.

Regenerate them after a change to either plugin and after a Kotlin or kotlin-wrappers upgrade. They were built with
Kotlin 2.4.21, kotlin-react-compiler 1.0.3-SNAPSHOT and kotlin-wrappers 2026.11.1-19.3.1, from `Sample.kt` in
`src/jsMain/kotlin` of a project named `todo-app` with `kotlin.js.ir.output.granularity=per-file` in
`gradle.properties` and this `build.gradle.kts`:

```kotlin
plugins {
    kotlin("multiplatform") version "2.4.21"
    id("io.github.porotkin.kotlin-react-compiler") version "1.0.3-SNAPSHOT"
}

kotlin {
    js {
        browser()
        binaries.executable()
        useEsModules()
    }
    sourceSets {
        jsMain {
            dependencies {
                implementation("org.jetbrains.kotlin-wrappers:kotlin-react:2026.11.1-19.3.1")
                implementation("org.jetbrains.kotlin-wrappers:kotlin-react-dom:2026.11.1-19.3.1")
            }
        }
    }
}
```

`./gradlew compileDevelopmentExecutableKotlinJs compileProductionExecutableKotlinJs` writes them to
`build/compileSync/js/main/<variant>Executable/kotlin/todo-app/sample/Sample.mjs`.

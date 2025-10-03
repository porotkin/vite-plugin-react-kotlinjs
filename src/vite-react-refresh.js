import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {exactRegex} from '@rolldown/pluginutils'
import {runtimePublicPath} from "./refresh-wrapper";
import {readFileSync} from 'node:fs'
import {silenceUseClientWarning} from "./warning";

const _dirname = dirname(fileURLToPath(import.meta.url))
const refreshRuntimePath = join(_dirname, 'refresh-runtime.js')
const dependencies = [
    'react',
    'react-dom',
]

export default (options) => ({
    name: 'vite:react-refresh',
    enforce: 'pre',
    config: (userConfig) => ({
        build: silenceUseClientWarning(userConfig),
        optimizeDeps: {
            include: dependencies,
        },
    }),
    resolveId: {
        filter: {id: exactRegex(runtimePublicPath)},
        handler(id) {
            if (id === runtimePublicPath) {
                return id
            }
        },
    },
    load: {
        filter: {id: exactRegex(runtimePublicPath)},
        handler(id) {
            if (id === runtimePublicPath) {
                return readFileSync(refreshRuntimePath, 'utf-8')
            }
        },
    },
    transformIndexHtml() {
        if (!options?.skipFastRefresh)
            return [
                {
                    tag: 'script',
                    attrs: {type: 'module'},
                    children: getPreambleCode(base),
                },
            ]
    },
})

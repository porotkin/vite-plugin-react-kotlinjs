import {defineConfig} from 'tsdown'

export default defineConfig({
    entry: { index: 'src/index.ts', worker: 'src/react-compiler/worker.ts' },
    fixedExtension: false,
    dts: true,
})

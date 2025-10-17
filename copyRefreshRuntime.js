import {readFile, writeFile} from 'fs/promises';

const refreshRuntime = 'refresh-runtime.js';
const normalizeExports = 'normalize-exports.js';

const source = await readFile(`./node_modules/@vitejs/plugin-react/dist/${refreshRuntime}`)
const normalizeExportsSource = await readFile(`./src/${normalizeExports}`)

await writeFile(`./src/${refreshRuntime}`, source + normalizeExportsSource, 'utf-8')

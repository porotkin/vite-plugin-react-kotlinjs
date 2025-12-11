import type {Plugin} from 'vite'

const REACT_JSX_FACTORY_IMPORT = 'react/jsx-dev-runtime';
const REACT_PLUGIN_ENABLER = `\nconst $$$___$$$___$$$ = "${REACT_JSX_FACTORY_IMPORT}"\n`;

export interface Options {
    isReactFC?: (code: string) => boolean
    getComponentName?: (code: string) => string | undefined
}

export default (
    options?: Options
): Plugin => {
    const {
        isReactFC = (code) => code.includes('kotlin-react-core/react/ChildrenBuilder.mjs'),
        getComponentName = (code) => /export {(?:.|\s)*get_([A-Za-z]+) as get_(?:.|\s)*}/.exec(code)?.[1],
    } = options ?? {} as Options

    return ({
        name: 'vite:react-plugin-kotlinjs',
        enforce: 'pre',
        apply: 'serve',
        transform(code: string) {
            if (!isReactFC(code)) {
                return {
                    code: code,
                    map: null,
                }
            }

            const componentName = getComponentName(code);
            if (!componentName) {
                return {
                    code: code,
                    map: null,
                }
            }

            const transformedCode = code
                    .replace(`function get_${componentName}() {`, `function Get${componentName}() {`)
                    .replace(`get_${componentName} as get_`, `Get${componentName} as get_`)

            return {
                code: transformedCode + REACT_PLUGIN_ENABLER,
                map: null,
            }
        }
    });
}

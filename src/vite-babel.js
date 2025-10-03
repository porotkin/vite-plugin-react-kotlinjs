import {addRefreshWrapper} from "./refresh-wrapper.js";

let babel;

async function loadBabel() {
    if (!babel) babel = await import("@babel/core");
    return babel;
}

let isProduction = true;
let projectRoot = process.cwd();
let runPluginOverrides;

function canSkipBabel(plugins, babelOptions) {
    return !(plugins.length || babelOptions.presets.length || babelOptions.configFile || babelOptions.babelrc);
}

const loadedPlugin = /* @__PURE__ */ new Map();

function loadPlugin(path) {
    const cached = loadedPlugin.get(path);
    if (cached) return cached;
    const promise = import(path).then((module) => {
        const value = module.default || module;
        loadedPlugin.set(path, value);
        return value;
    });
    loadedPlugin.set(path, promise);
    return promise;
}

function createBabelOptions(rawOptions) {
    const babelOptions = {
        babelrc: false,
        configFile: false,
        ...rawOptions
    };
    babelOptions.plugins ||= [];
    babelOptions.presets ||= [];
    babelOptions.overrides ||= [];
    babelOptions.parserOpts ||= {};
    babelOptions.parserOpts.plugins ||= [];
    return babelOptions;
}

export const viteBabelPlugin = (mainOptions) => ({
    name: "vite:react-plugin-kotlinjs",
    enforce: "pre",
    configResolved(config) {
        projectRoot = config.root;
        isProduction = config.isProduction;
        mainOptions.skipFastRefresh = isProduction || config.command === "build" || config.server.hmr === false;
        const hooks = config.plugins.map((plugin) => plugin.api?.reactBabel).filter(function (value) {
            return value !== void 0;
        });
        if (hooks.length > 0) runPluginOverrides = (babelOptions, context) => {
            hooks.forEach((hook) => hook(babelOptions, context, config));
        };
    },
    transform: {
        async handler(code, id, options) {
            const [filepath] = id.split("?");
            if (!mainOptions?.filter(filepath) || !mainOptions?.getComponentName(code)) return;
            const ssr = options?.ssr === true;
            const babelOptions = (() => {
                const newBabelOptions = createBabelOptions({});
                runPluginOverrides?.(newBabelOptions, {
                    id,
                    ssr
                });
                return newBabelOptions;
            })();
            const plugins = [...babelOptions.plugins];
            const useFastRefresh = !mainOptions.skipFastRefresh;
            if (useFastRefresh) plugins.push([await loadPlugin("react-refresh/babel"), {skipEnvCheck: true}]);
            if (canSkipBabel(plugins, babelOptions)) return;
            const parserPlugins = [...babelOptions.parserOpts.plugins];
            if (!filepath.endsWith(".ts")) parserPlugins.push("jsx");
            const result = await (await loadBabel()).transformAsync(code, {
                ...babelOptions,
                root: projectRoot,
                filename: id,
                sourceFileName: filepath,
                retainLines: !isProduction,
                parserOpts: {
                    ...babelOptions.parserOpts,
                    sourceType: "module",
                    allowAwaitOutsideFunction: true,
                    plugins: parserPlugins
                },
                generatorOpts: {
                    ...babelOptions.generatorOpts,
                    importAttributesKeyword: "with",
                    decoratorsBeforeExport: true
                },
                plugins,
                sourceMaps: true
            });
            if (result) {
                if (!useFastRefresh) return {
                    code: result.code,
                    map: result.map
                };
                return {
                    code: addRefreshWrapper(result.code, "vite:react-plugin-kotlinjs", id, mainOptions?.getComponentName) ?? result.code,
                    map: result.map
                };
            }
        }
    }
})

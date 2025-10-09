import {addRefreshWrapper} from "./refresh-wrapper.js";

export const viteBabelPlugin = (mainOptions) => ({
    name: "vite:react-plugin-kotlinjs",
    enforce: "pre",
    configResolved(config) {
        mainOptions.skipFastRefresh = config.isProduction || config.command === "build" || config.server.hmr === false;
    },
    transform: {
        async handler(code, id) {
            const [filepath] = id.split("?");
            if (!mainOptions?.filter(filepath) || !mainOptions?.getComponentName(code)) return;
            const useFastRefresh = !mainOptions.skipFastRefresh;
            if (!useFastRefresh) return {
                code: code,
                map: null,
            };
            return {
                code: addRefreshWrapper(code, "vite:react-plugin-kotlinjs", id, mainOptions?.getComponentName),
                map: null,
            };
        }
    }
})

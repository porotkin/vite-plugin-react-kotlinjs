export function normalizeExports(value) {
    if (!value) return [];
    const [entry] = Object.entries(value)
    if (!entry) return [];
    const [key, type] = entry
    const name = key.replace("get_", "");
    return {
        [name]: (...args) => type?.(...args),
    }
}

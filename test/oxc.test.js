import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
import reactKotlinJs from '../dist/index.js';

const KOTLIN_JSX = '../../../../kotlin-react/react/jsx/runtime/jsx.mjs';

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kotlin-react-compiler-'));

function positionOf(code, text) {
    const lines = code.slice(0, code.indexOf(text)).split('\n');
    return { line: lines.length, column: lines.at(-1).length };
}

async function compile(code, reactCompiler = {}, config = undefined) {
    const events = [];
    const logger = { logEvent: (_filename, event) => events.push(event) };
    const [, compiler] = reactKotlinJs({ reactCompiler: { backend: 'oxc', logger, ...reactCompiler } });
    if (config) compiler.configResolved(config);
    const compiled = await compiler.transform.handler(code, 'App.mjs');
    return { compiled, events, compiler };
}

function evaluate(code, modules, name) {
    const bindings = [];
    const body = code.replace(/^import\s*{([^}]*)}\s*from\s*["']([^"']+)["'];?$/gm, (_, specifiers, source) => {
        for (const specifier of specifiers.split(',').map((it) => it.trim()).filter(Boolean)) {
            const [imported, local = imported] = specifier.split(/\s+as\s+/);
            bindings.push(`const ${local} = modules[${JSON.stringify(source)}].${imported};`);
        }
        return '';
    }).replace(/^export\s*{[^}]*};?$/gm, '');
    return new Function('modules', `${bindings.join('\n')}\n${body}\nreturn ${name};`)(modules);
}

const component = `import { jsx2uf3lx2x6pvok as jsx } from '${KOTLIN_JSX}';
import { jsx as jsx_0 } from 'react/jsx-runtime';
function App(props) {
  'use memo';
  var label = jsx_0('span', { children: props.title });
  return jsx('div', { children: label }, 'key');
}
export { App as App1a2b3c };`;

describe('oxc backend', () => {
    test('memoize Kotlin jsx() calls as JSX elements and call them with the same arguments at runtime', async () => {
        const { compiled, compiler } = await compile(component);
        assert.match(compiled.code, /react\/compiler-runtime/);
        assert.match(compiled.code, /virtual:kotlin-react-compiler\/unwrap\/jsx-runtime/);
        assert.ok(compiled.map.mappings.length > 0);

        const runtimeId = compiler.resolveId('virtual:kotlin-react-compiler/unwrap/jsx-runtime');
        const unwrap = evaluate(compiler.load(runtimeId), {}, '{ jsx: unwrap, jsxs: unwrap }');
        const calls = [];
        const cache = [];
        const App = evaluate(compiled.code, {
            'react/compiler-runtime': { c: (size) => cache.length ? cache : Object.assign(cache, Array(size).fill(Symbol.for('react.memo_cache_sentinel'))) },
            'virtual:kotlin-react-compiler/unwrap/jsx-runtime': unwrap,
            [KOTLIN_JSX]: { jsx2uf3lx2x6pvok: (...args) => (calls.push(['kotlin', ...args]), { kotlin: args }) },
            'react/jsx-runtime': { jsx: (...args) => (calls.push(['react', ...args]), { react: args }) },
        }, 'App');

        const first = App({ title: 'a' });
        assert.deepEqual(calls, [
            ['react', 'span', { children: 'a' }, undefined],
            ['kotlin', 'div', { children: { react: ['span', { children: 'a' }, undefined] } }, 'key'],
        ]);
        assert.equal(App({ title: 'a' }), first);
        assert.equal(calls.length, 2);
        App({ title: 'b' });
        assert.equal(calls.length, 4);
    });

    test('leave a function calling a hook listed in incompatibleHooks uncompiled', async () => {
        const { compiled, events } = await compile(`import { useWindowVirtualizer as useWindowVirtualizer } from '@tanstack/react-virtual';
import { jsx as jsx } from 'react/jsx-runtime';
function List(props) {
  'use memo';
  var virtualizer = useWindowVirtualizer(props.options);
  return jsx('ul', { children: virtualizer.getVirtualItems() });
}
export { List as List1a2b3c };`, { incompatibleHooks: { '@tanstack/react-virtual': ['useWindowVirtualizer'] } });
        assert.doesNotMatch(compiled.code, /react\/compiler-runtime/);
        assert.deepEqual(events.map((e) => [e.kind, e.fnName, e.detail.category]), [['CompileError', 'List', 'IncompatibleLibrary']]);
    });

    test('leave a function calling a listed hook uncompiled in infer mode', async () => {
        const { compiled, events } = await compile(`import { useWindowVirtualizer as useWindowVirtualizer } from 'my-virtualizer';
import { jsx as jsx } from 'react/jsx-runtime';
function List(props) {
  var virtualizer = useWindowVirtualizer(props.options);
  return jsx('ul', { children: virtualizer.getVirtualItems() });
}
export { List as List1a2b3c };`, {
            compilationMode: 'infer',
            incompatibleHooks: { 'my-virtualizer': ['useWindowVirtualizer'] },
        });
        assert.doesNotMatch(compiled.code, /react\/compiler-runtime/);
        assert.deepEqual(events.map((e) => [e.kind, e.fnName, e.detail.category]), [['CompileError', 'List', 'IncompatibleLibrary']]);
    });

    test('compile the same module twice at once', async () => {
        const [, compiler] = reactKotlinJs({ reactCompiler: { backend: 'oxc' } });
        const results = await Promise.all([compiler.transform.handler(component, 'App.mjs'), compiler.transform.handler(component, 'App.mjs')]);

        for (const result of results) {
            assert.match(result.code, /react\/compiler-runtime/);
            assert.doesNotMatch(result.code, /<Jsx/);
        }
        assert.equal(results[0].code, results[1].code);
    });

    test('report a function whose manual memoization cannot be preserved as PreserveManualMemo', async () => {
        const { events } = await compile(`import { useCallback as useCallback } from 'react';
function useHandler(props) {
  'use memo';
  return useCallback(() => props.onClick(props.id), [props.id]);
}
export { useHandler as useHandler1a2b3c };`);
        assert.deepEqual(events.map((e) => [e.kind, e.fnName, e.detail.category]), [['CompileError', 'useHandler', 'PreserveManualMemo']]);
        assert.deepEqual([events[0].fnLoc.start, events[0].fnLoc.end], [{ line: 2, column: 0 }, { line: 5, column: 1 }]);
        assert.equal(events[0].detail.loc.start.line, 4);
    });

    test('locate a diagnostic after non-ASCII text, which oxc reports in UTF-8 bytes', async () => {
        const { events } = await compile(`var arrows = '←→↑↓ ✈';
import { useCallback as useCallback } from 'react';
const useHandler = (props) => {
  'use memo';
  return useCallback(() => props.onClick(props.id), [props.id]);
};
export { useHandler as useHandler1a2b3c };`);
        assert.deepEqual(events.map((e) => [e.fnName, e.fnLoc.start.line, e.detail.loc.start.line]), [['useHandler', 3, 5]]);
    });

    test("compile a module calling mutableValue() with Babel, which rejects a write through it during render", async () => {
        const mutableValueImport = "import { mutableValue1a2b3c as mutableValue } from '../krc/com/github/porotkin/reactcompiler/MutableValue.mjs';";
        const { compiled: duringRender, events } = await compile(`${mutableValueImport}
function useCanary(target) {
  'use memo';
  var write = () => { mutableValue(target).hidden = true; };
  write();
}
export { useCanary };`);
        assert.doesNotMatch(duringRender.code, /react\/compiler-runtime/);
        assert.deepEqual(events.map((e) => e.kind), ['CompileError']);

        const { compiled: inEffect } = await compile(`${mutableValueImport}
import { useEffect as useEffect } from 'react';
function useHide(target) {
  'use memo';
  useEffect(() => { mutableValue(target).hidden = true; }, [target]);
}
export { useHide };`);
        assert.match(inEffect.code, /react\/compiler-runtime/);
    });

    test('hoist a memo directive above Kotlin property initialization without running Babel', async () => {
        const { compiled, events } = await compile(`import { jsx as jsx } from 'react/jsx-runtime';
function App(props) {
  _init_properties_App_kt();
  'use memo';
  return jsx('b', { children: props.value });
}
export { App };`);
        assert.match(compiled.code, /react\/compiler-runtime/);
        assert.deepEqual(events, []);
    });

    test('run Babel for a module with function-local var declarations', async () => {
        const { compiled } = await compile(`function App(props) {
  'use memo';
  var value = props.value;
  return value;
}
export { App };`);

        assert.match(compiled.code, /const value = props\.value;/);
        const { line } = originalPositionFor(new TraceMap(compiled.map), positionOf(compiled.code, 'props.value'));
        assert.equal(line, 3);
    });

    test('leave source maps out of a build that emits none', async () => {
        const { compiled } = await compile(component, {}, { command: 'build', cacheDir: tempDir(), build: { sourcemap: false } });
        assert.match(compiled.code, /react\/compiler-runtime/);
        assert.equal(compiled.map, null);
    });

    test('run Babel for listed incompatible-hook sources without JSX runtime imports', async () => {
        const { compiled, events } = await compile(`import { useWindowVirtualizer as useWindowVirtualizer } from 'my-virtualizer';
function useRows(options) {
  'use memo';
  return useWindowVirtualizer(options);
}
export { useRows };`, {
            compilationMode: 'infer',
            incompatibleHooks: { 'my-virtualizer': ['useWindowVirtualizer'] },
        });

        assert.ok(compiled.map);
        assert.match(compiled.code, /use no memo/);
        assert.deepEqual(events.map((event) => [event.kind, event.fnName, event.detail.category]), [
            ['CompileError', 'useRows', 'IncompatibleLibrary'],
        ]);
    });

    test('compile a function kotlin-react-compiler marks with __krcUseMemo()', async () => {
        const { compiled } = await compile(component.replace("  'use memo';", '  __krcUseMemo();'));
        assert.match(compiled.code, /react\/compiler-runtime/);
        assert.doesNotMatch(compiled.code, /__krcUseMemo/);
    });

    test('reuse the result for unchanged code from the cache, with its events', async () => {
        const config = { command: 'serve', cacheDir: tempDir(), build: { sourcemap: false } };
        const module = `import { useCallback as useCallback } from 'react';
function useHandler(props) {
  'use memo';
  return useCallback(() => props.onClick(props.id), [props.id]);
}
export { useHandler };`;
        const first = await compile(module, {}, config);
        const root = path.join(config.cacheDir, 'vite-plugin-react-kotlinjs');
        const [pack] = fs.readdirSync(root, { recursive: true }).filter((f) => f.endsWith('.pack')).map((f) => path.join(root, f));
        const line = fs.readFileSync(pack, 'utf8').trimEnd();
        const stored = JSON.parse(line.slice(2 * 41));
        stored.result.code = `/* from the cache */\n${stored.result.code}`;
        fs.writeFileSync(pack, `${line.slice(0, 2 * 41)}${JSON.stringify(stored)}\n`);

        const second = await compile(module, {}, config);
        assert.equal(second.compiled.code, `/* from the cache */\n${first.compiled.code}`);
        assert.deepEqual(second.events, first.events);

        const changed = await compile(module.replace('props.id', 'props.key'), {}, config);
        assert.match(changed.compiled.code, /props\.key/);
    });

    test('skip modules without "use memo" in annotation mode', async () => {
        const { compiled } = await compile(`import { jsx as jsx } from 'react/jsx-runtime';
function App() {
  return jsx('div', {});
}`);
        assert.equal(compiled, null);
    });
});

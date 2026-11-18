import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import reactKotlinJs from '../dist/index.js';

const KOTLIN_JSX = '../../../../kotlin-react/react/jsx/runtime/jsx.mjs';

function compile(code, reactCompiler = {}) {
    const events = [];
    const logger = { logEvent: (_filename, event) => events.push(event) };
    const [, prepass, compiler] = reactKotlinJs({ reactCompiler: { backend: 'oxc', logger, ...reactCompiler } });
    const prepared = prepass.transform.handler(code, 'App.mjs');
    if (!prepared) return { prepared, events };
    const compiled = compiler.transform.handler(prepared.code, 'App.mjs');
    return { prepared, compiled, events, compiler };
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
    test('memoize Kotlin jsx() calls as JSX elements and call them with the same arguments at runtime', () => {
        const { compiled, compiler } = compile(component);
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

    test('leave a function calling a hook listed in incompatibleHooks uncompiled', () => {
        const { compiled, events } = compile(`import { useWindowVirtualizer as useWindowVirtualizer } from '@tanstack/react-virtual';
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

    test('leave a function calling a listed hook uncompiled in infer mode', () => {
        const { compiled, events } = compile(`import { useWindowVirtualizer as useWindowVirtualizer } from 'my-virtualizer';
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

    test('compile both same-id modules when prepasses interleave', () => {
        const [, prepass, compiler] = reactKotlinJs({ reactCompiler: { backend: 'oxc' } });
        const firstPrepared = prepass.transform.handler(component, 'App.mjs');
        const secondPrepared = prepass.transform.handler(component, 'App.mjs');
        const first = compiler.transform.handler(firstPrepared.code, 'App.mjs');
        const second = compiler.transform.handler(secondPrepared.code, 'App.mjs');

        for (const result of [first, second]) {
            assert.match(result.code, /react\/compiler-runtime/);
            assert.doesNotMatch(result.code, /__VITE_PLUGIN_REACT_KOTLINJS_OXC_PREPARED__/);
            assert.doesNotMatch(result.code, /<Jsx/);
        }
    });

    test('report a function whose manual memoization cannot be preserved as PreserveManualMemo', () => {
        const { events } = compile(`import { useCallback as useCallback } from 'react';
function useHandler(props) {
  'use memo';
  return useCallback(() => props.onClick(props.id), [props.id]);
}
export { useHandler as useHandler1a2b3c };`);
        assert.deepEqual(events.map((e) => [e.kind, e.fnName, e.detail.category]), [['CompileError', 'useHandler', 'PreserveManualMemo']]);
        assert.deepEqual([events[0].fnLoc.start, events[0].fnLoc.end], [{ line: 2, column: 0 }, { line: 5, column: 1 }]);
        assert.equal(events[0].detail.loc.start.line, 4);
    });

    test('locate a diagnostic after non-ASCII text, which oxc reports in UTF-8 bytes', () => {
        const { events } = compile(`var arrows = '←→↑↓ ✈';
import { useCallback as useCallback } from 'react';
const useHandler = (props) => {
  'use memo';
  return useCallback(() => props.onClick(props.id), [props.id]);
};
export { useHandler as useHandler1a2b3c };`);
        assert.deepEqual(events.map((e) => [e.fnName, e.fnLoc.start.line, e.detail.loc.start.line]), [['useHandler', 3, 5]]);
    });

    test("compile a module calling mutableValue() with Babel, which rejects a write through it during render", () => {
        const mutableValueImport = "import { mutableValue1a2b3c as mutableValue } from '../krc/com/github/porotkin/reactcompiler/MutableValue.mjs';";
        const { prepared: duringRender, events } = compile(`${mutableValueImport}
function useCanary(target) {
  'use memo';
  var write = () => { mutableValue(target).hidden = true; };
  write();
}
export { useCanary };`);
        assert.doesNotMatch(duringRender.code, /__VITE_PLUGIN_REACT_KOTLINJS_OXC_PREPARED__|react\/compiler-runtime/);
        assert.deepEqual(events.map((e) => e.kind), ['CompileError']);

        const { prepared: inEffect } = compile(`${mutableValueImport}
import { useEffect as useEffect } from 'react';
function useHide(target) {
  'use memo';
  useEffect(() => { mutableValue(target).hidden = true; }, [target]);
}
export { useHide };`);
        assert.match(inEffect.code, /react\/compiler-runtime/);
    });

    test('hoist a memo directive above Kotlin property initialization without running Babel', () => {
        const code = `function App(props) {
  _init_properties_App_kt();
  'use memo';
  // preserve this comment
  return props.value;
}
export { App };`;
        const { prepared, compiled } = compile(code);
        const preparedCode = prepared.code.replace(/\n\/\*__VITE_PLUGIN_REACT_KOTLINJS_OXC_PREPARED__\*\/$/, '');

        assert.equal(prepared.map, null);
        assert.equal(preparedCode.split('\n').length, code.split('\n').length);
        assert.equal(
            preparedCode
                .replace("function App(props) {'use memo';", 'function App(props) {')
                .replace(/^ +$/m, "  'use memo';"),
            code,
        );
        assert.match(preparedCode, /\/\/ preserve this comment/);
        assert.doesNotMatch(compiled.code, /__VITE_PLUGIN_REACT_KOTLINJS_OXC_PREPARED__/);
    });

    test('run Babel for a module with function-local var declarations', () => {
        const { prepared, compiled } = compile(`function App(props) {
  'use memo';
  var value = props.value;
  return value;
}
export { App };`);

        assert.match(prepared.code, /let value = props\.value;/);
        assert.match(compiled.code, /const value = props\.value;/);
        assert.doesNotMatch(compiled.code, /__VITE_PLUGIN_REACT_KOTLINJS_OXC_PREPARED__/);
    });

    test('run Babel for listed incompatible-hook sources without JSX runtime imports', () => {
        const { prepared, events } = compile(`import { useWindowVirtualizer as useWindowVirtualizer } from 'my-virtualizer';
function useRows(options) {
  'use memo';
  return useWindowVirtualizer(options);
}
export { useRows };`, {
            compilationMode: 'infer',
            incompatibleHooks: { 'my-virtualizer': ['useWindowVirtualizer'] },
        });

        assert.ok(prepared.map);
        assert.match(prepared.code, /use no memo/);
        assert.deepEqual(events.map((event) => [event.kind, event.fnName, event.detail.category]), [
            ['CompileError', 'useRows', 'IncompatibleLibrary'],
        ]);
    });

    test('skip modules without "use memo" in annotation mode', () => {
        const { prepared } = compile(`import { jsx as jsx } from 'react/jsx-runtime';
function App() {
  return jsx('div', {});
}`);
        assert.equal(prepared, null);
    });
});

import assert from 'node:assert/strict';
import {SourceMap} from 'node:module';
import {describe, test} from 'node:test';
import {compileKotlinMjs, projectRequire} from '../dist/index.js';
import {normalizeCases} from './fixtures/normalize-cases.js';

describe('compileKotlinMjs', () => {
    // Kotlin/JS names temporaries `tmp`, `tmp_0`, … per function, so an inner `tmp` shadows an outer one next to `tmp_0`.
    const shadowedTemporaries = (render) => `import { useCallback, useRef } from 'react';
import { jsx } from 'react/jsx-runtime';
export function Foo(props) {
  'use memo';
  var ref = useRef(null);
  var cb = useCallback(() => {
    var tmp = props.a;
    return tmp;
  }, [props.a]);
  var tmp = props.b;
  var tmp_0 = props.c;
  ${render}
  return jsx('div', { onClick: cb, title: tmp, id: tmp_0 });
}`;
    const assignedFrom = (code, value) => new RegExp(`(\\w+) = ${value.replace('.', '\\.')};`).exec(code)?.[1];

    // Kotlin/JS `var`s are function-scoped: the loop condition reads one declared in the loop body.
    const doWhileVar = `export function useEngineLabels(nEngines) {
  'use memo';
  var labels = [];
  var inductionVariable = 0;
  if (inductionVariable <= nEngines)
    do {
      var engine = inductionVariable;
      inductionVariable = inductionVariable + 1 | 0;
      labels.push('E' + engine);
    }
     while (!(engine === nEngines));
  return labels;
}`;
    // A nested redeclaration assigns the same `var`; as two `let`s the outer one would shadow it on return.
    const nestedRedeclaration = `export function useLabel(props) {
  'use memo';
  var tmp = props.a;
  if (props.flag) {
    var tmp = props.b;
  }
  return tmp;
}`;
    const babel = projectRequire('@babel/core');
    const unboundNames = (code) => {
        const names = new Set();
        babel.traverse(babel.parseSync(code, { sourceType: 'module', configFile: false, babelrc: false }), {
            ReferencedIdentifier(path) {
                const { name } = path.node;
                if (!path.scope.hasBinding(name, true) && !(name in globalThis)) names.add(name);
            },
        });
        return names;
    };
    const run = (code, name) => new Function(`${code.replace(/^export /gm, '')}\nreturn ${name};`)();

    test('declares a do-while body var read by the loop condition at the top of its function', () => {
        const {code, events} = compileKotlinMjs(doWhileVar);
        assert.deepEqual(events.map((e) => e.kind), ['CompileSuccess']);
        assert.match(code, /let engine;/);
        assert.ok(!unboundNames(code).has('engine'));
    });

    test('keeps a var redeclared in a nested block one variable', () => {
        const {code, events} = compileKotlinMjs(nestedRedeclaration);
        assert.deepEqual(events.map((e) => e.kind), ['CompileSuccess']);
        assert.equal(run(code, 'useLabel')({ a: 'a', b: 'b', flag: true }), 'b');
        assert.equal(run(code, 'useLabel')({ a: 'a', b: 'b', flag: false }), 'a');
    });

    test('leaves no identifier unbound that the Kotlin/JS input binds', () => {
        for (const input of [...normalizeCases.map((c) => c.input), doWhileVar, nestedRedeclaration]) {
            const before = unboundNames(input);
            const lost = [...unboundNames(compileKotlinMjs(input).code)].filter((name) => !before.has(name));
            assert.deepEqual(lost, [], `unbound after compiling:\n${input}`);
        }
    });

    test('skips functions calling hooks listed in incompatibleHooks, and only those', () => {
        const input = `import { useReactTable as useReactTable } from '@tanstack/react-table';
export function useRows(options) {
  'use memo';
  var table = useReactTable(options);
  return table.getRowModel();
}`;
        assert.deepEqual(compileKotlinMjs(input).events.map((e) => e.kind), ['CompileSuccess']);
        const { code, events } = compileKotlinMjs(input, 'module.mjs', {
            incompatibleHooks: { '@tanstack/react-table': ['useReactTable'] },
        });
        assert.deepEqual(events.map((e) => e.kind), ['CompileError']);
        assert.doesNotMatch(code, /_c\(/);
    });

    test('compiles a component whose "use memo" follows Kotlin property initialization', () => {
        const { code, events } = compileKotlinMjs(`import { jsx } from 'react/jsx-runtime';
var initialized;
function _init_properties_Badge_kt__d9zukm() {
  initialized = true;
}
export function Badge$lambda(props) {
  _init_properties_Badge_kt__d9zukm();
  'use memo';
  return jsx('div', { title: props.label });
}`);
        assert.deepEqual(events.map((e) => e.kind), ['CompileSuccess']);
        assert.match(code, /react\/compiler-runtime/);
    });

    test('keeps shadowed Kotlin temporaries apart when compiled', () => {
        const {code, events} = compileKotlinMjs(shadowedTemporaries(''));
        assert.deepEqual(events.map((e) => e.kind), ['CompileSuccess']);
        assert.match(code, new RegExp(`title: ${assignedFrom(code, 'props.b')},`));
        assert.match(code, new RegExp(`id: ${assignedFrom(code, 'props.c')}\\b`));
    });

    test('keeps shadowed Kotlin temporaries apart when the compiler bails out', () => {
        const {code, events} = compileKotlinMjs(shadowedTemporaries('ref.current = 1;'));
        assert.deepEqual(events.map((e) => e.kind), ['CompileError']);
        projectRequire('@babel/core').parseSync(code, {sourceType: 'module', configFile: false, babelrc: false});
        assert.match(code, new RegExp(`title: ${assignedFrom(code, 'props.b')},`));
    });

    test('compiles components importing mangled jsx and passing props.ref to a hook', () => {
        const { code, events } = compileKotlinMjs(`import { jsx2uf3lx2x6pvok as jsx } from '../../../../kotlin-react/react/jsx/runtime/jsx.mjs';
export function SidebarButton$lambda(props) {
  'use memo';
  var tmp0 = props.ref;
  useFocusTrap(tmp0);
  var attrs = {};
  attrs.ref = props.ref;
  attrs.title = props.label;
  return jsx('button', attrs, '@rdk/32_4');
}`);
        assert.deepEqual(events.map((e) => e.kind), ['CompileSuccess']);
        assert.match(code, /ref: _ref\s*\} = props;/);
        assert.doesNotMatch(code, /props\.ref/);
    });

    test('destructures props.ref apart from outer names, leaving a shadowing inner props alone', () => {
        const { code, events } = compileKotlinMjs(`import { jsx } from 'react/jsx-runtime';
var ref = 5;
function Outer$lambda(props) {
  'use memo';
  var renderInner = (props) => props.ref;
  var attrs = {};
  attrs.ref = props.ref;
  attrs.fallback = ref;
  attrs.render = renderInner;
  return jsx('div', attrs);
}`);
        assert.deepEqual(events.map((e) => e.kind), ['CompileSuccess']);
        assert.match(code, /attrs\.ref = _ref;/);
        assert.match(code, /attrs\.fallback = ref;/);
        assert.match(code, /\b_?props\.ref\b/);
    });

    test('leaves props.ref alone in non-components, on null-checked props and when written', () => {
        const { code } = compileKotlinMjs(`function useHelper(el) {
  'use memo';
  return el.ref;
}
function Guarded$lambda(el) {
  'use memo';
  return el == null ? null : el.ref;
}
function Mutating$lambda(holder) {
  'use memo';
  holder.ref = 2;
  return holder.ref;
}`);
        assert.doesNotMatch(code, /_ref/);
    });

    test('rewrites VOID default arguments with collision-free parameter names', () => {
        // Without "use memo" nothing is compiled in annotation mode, so the output is the Babel pre-pass alone.
        const { code } = compileKotlinMjs(`function useTimeout(x, _x, delay) {
  x = x === VOID ? 1 : x;
  if (delay === VOID) {
    delay = 500;
  }
  return x + _x + delay;
}
function useSelf(x) {
  x = x === VOID ? f(x) : x;
  return x;
}`);
        assert.equal(code, `function useTimeout(_x2, _x, _delay) {
  let x = _x2 === VOID ? 1 : _x2;
  let delay = _delay === VOID ? 500 : _delay;
  return x + _x + delay;
}
function useSelf(x) {
  x = x === VOID ? f(x) : x;
  return x;
}`);
    });

    test('compiles hooks with VOID default parameters, BigInt literals and $slambda refs', () => {
        const { events } = compileKotlinMjs(`import { useCallback, useRef } from 'react';
import { useEffect1jlgi6hiv8qwn as useEffect } from '../../../kotlin-react/react/useEffect.mjs';
import { constructCallableReference23y65rf941mch as constructCallableReference } from './reflectRuntime.mjs';
export function useAction(value, enabled) {
  enabled = enabled === VOID ? true : enabled;
  'use memo';
  var service = useStableService();
  var opRef = useRef(null);
  useEffect([value, enabled], useAction$slambda(value, opRef));
  return useCallback(() => service.run(value, enabled, 1000n), [service, value, enabled]);
}
function useAction$slambda($value, $opRef) {
  return constructCallableReference(($this$useEffect, $completion) => {
    $opRef.current = $value;
  }, 1);
}`);
        assert.deepEqual(events.map((e) => e.kind), ['CompileSuccess']);
    });

    test('bails out where existing memoization cannot be preserved, unless preserveExistingMemoizationGuarantees is false', () => {
        const input = `import { useCallback } from 'react';
export function useAction(value) {
  'use memo';
  var service = useStableService();
  return useCallback(() => service.run(value), [value]);
}`;
        assert.deepEqual(compileKotlinMjs(input).events.map((e) => e.kind), ['CompileError']);
        assert.deepEqual(
            compileKotlinMjs(input, 'module.mjs', { preserveExistingMemoizationGuarantees: false }).events.map((e) => e.kind),
            ['CompileSuccess'],
        );
    });

    test('keeps a useMemo result memoized when it is passed on after a hook call', () => {
        // Without preserving, the compiler flattens this scope across `useEffect` and recomputes `state` every render.
        const input = `import { useEffect, useMemo } from 'react';
export function useSorting(columns, sorting) {
  'use memo';
  var state = useMemo(() => effective(columns, sorting), [columns, sorting]);
  useEffect(() => {}, [state === sorting]);
  return withFns(columns, state);
}`;
        const memoized = /if \(\$\[\d+\] !== columns \|\| \$\[\d+\] !== sorting\) \{\s*t\d+ = effective\(columns, sorting\);/;
        assert.match(compileKotlinMjs(input).code, memoized);
        assert.doesNotMatch(compileKotlinMjs(input, 'module.mjs', { preserveExistingMemoizationGuarantees: false }).code, memoized);
    });

    test('aliases imported synthetic $ref helpers so conditional prop assignments do not fail hook rules', () => {
        const { code, events } = compileKotlinMjs(`import { jsx2uf3lx2x6pvok as jsx } from '../../../../kotlin-react/react/jsx/runtime/jsx.mjs';
import {
  useComparisonLog$refb9aevfxnsp1k as useComparisonLog$ref,
  useComparisonLog1fdlqot6w3m5v as useComparisonLog,
} from './useComparisonLog.mjs';
export function LogsLoader$lambda(props) {
  _init_properties_LogsLoader_kt__kiakqq();
  'use memo';
  var isComparisonMode = useComparisonLog(props.id);
  var tmp;
  if (isComparisonMode) {
    var attrs = {};
    attrs.useData = useComparisonLog$ref();
    tmp = jsx('div', attrs, '@rdk/23_8');
  } else {
    tmp = null;
  }
  return tmp;
}`);
        assert.deepEqual(events.map((e) => e.kind), ['CompileSuccess']);
        assert.match(code, /useComparisonLog1fdlqot6w3m5v as useComparisonLog/);
        assert.match(code, /useComparisonLog\(props\.id\)/);
        assert.doesNotMatch(code, /let _useComparisonLog = useComparisonLog/);
        assert.match(code, /let _useComparisonLog\$ref = useComparisonLog\$ref;/);
        assert.match(code, /_useComparisonLog\$ref\(\)/);
    });

    test('leaves a function opting out with "use no memo" uncompiled when Kotlin displaced both directives', () => {
        const { code, events } = compileKotlinMjs(`import { useState } from 'react';
export function useRows(table) {
  _init_properties_Rows_kt__d9zukm();
  'use memo';
  'use no memo';
  var selected = useState(0)[0];
  return table.getRowModel().rows.concat(selected);
}`);
        assert.deepEqual(events.map((e) => e.kind), ['CompileSkip']);
        assert.doesNotMatch(code, /compiler-runtime/);
    });

    test('keeps a hoisted callback that is used beyond the hook', () => {
        const { code } = compileKotlinMjs(`import { useMemo } from 'react';
export function useThing(a) {
  'use memo';
  var cb = () => a + 1;
  var value = useMemo(cb, [a]);
  register(cb);
  return value;
}`);
        assert.deepEqual([...unboundNames(code)], ['register']);
    });

    test('leaves module-level var declarations alone', () => {
        const { code, events } = compileKotlinMjs(`import { useState } from 'react';
var properties_initialized_Foo_kt_1;
var Foo;
export function get_Foo() {
  if (!properties_initialized_Foo_kt_1) {
    properties_initialized_Foo_kt_1 = true;
    Foo = 1;
  }
  return Foo;
}
export function useFoo(a) {
  'use memo';
  var state = useState(a)[0];
  return state + get_Foo();
}`);
        assert.deepEqual(events.map((e) => e.kind), ['CompileSuccess']);
        assert.match(code, /^var properties_initialized_Foo_kt_1;$/m);
        assert.match(code, /^var Foo;$/m);
    });

    test('maps compiled code back to the lines of the Kotlin/JS module', () => {
        // The directive hoist and the inlined effect callback both move lines, the compiler rewrites the rest.
        const input = `import { useEffect } from 'react';
import { Unit_getInstance3abc as Unit_getInstance } from './stdlib.mjs';
export function useTitle(props) {
  _init_properties_Title_kt__a1b2c3();
  'use memo';
  var title = formatTitle(props.title);
  useEffect(useTitle$lambda, [title]);
  return decorateTitle(title);
}
function useTitle$lambda() {
  reportTitleShown();
  return Unit_getInstance();
}`;
        const { code, map } = compileKotlinMjs(input, 'Title.mjs');
        const sourceMap = new SourceMap(map);
        const originalLineOf = (token) => {
            const lines = code.split('\n');
            const line = lines.findIndex((text) => text.includes(token));
            return sourceMap.findEntry(line, lines[line].indexOf(token)).originalLine + 1;
        };
        const inputLineOf = (token) => input.split('\n').findIndex((text) => text.includes(token)) + 1;
        for (const token of ['formatTitle', 'decorateTitle']) {
            assert.equal(originalLineOf(token), inputLineOf(token), token);
        }
    });
});

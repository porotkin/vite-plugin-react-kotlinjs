import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import reactKotlinJs, {compileKotlinMjs, normalizeKotlinMjs, projectRequire} from '../dist/index.js';

const normalize = (code) => normalizeKotlinMjs(code).replace(/[ \t]+$/gm, '');

const normalizeCases = [
    {
        name: 'moves "use memo" above Kotlin default arguments and property initialization',
        input: `function Badge$lambda(props, compact) {
  compact = compact === VOID ? false : compact;
  _init_properties_Badge_kt__d9zukm();
  'use memo';
  return props.label;
}`,
        expected: `function Badge$lambda(props, compact) {
  'use memo';
  compact = compact === VOID ? false : compact;
  _init_properties_Badge_kt__d9zukm();

  return props.label;
}`,
    },

    {
        name: 'keeps the hoisted "use memo" when the statement it moves above is rewritten too',
        input: `function Badge$lambda(props){var label = props.label; 'use memo'; return label;}`,
        expected: `function Badge$lambda(props){
  'use memo';var label = props.label;  return label;}`,
    },

    {
        name: 'hoists "use memo" in lowered arrow component lambdas',
        input: `const Dialog = Popup((props) => {
  _init_properties_Dialog_kt__a1b2c3();
  'use memo';
  return jsx('div', { children: props.title });
});`,
        expected: `const Dialog = Popup((props) => {
  'use memo';
  _init_properties_Dialog_kt__a1b2c3();

  return jsx('div', { children: props.title });
});`,
    },

    {
        name: 'destructures useState and inlines a lifted useEffect callback',
        input: `import { useState, useEffect } from 'react';
import { Unit_getInstance3abc as Unit_getInstance } from './stdlib.mjs';
function App$lambda() {
  var tmp = useState(0);
  var count = tmp[0];
  var setCount = tmp[1];
  useEffect(App$lambda$lambda, []);
}
function App$lambda$lambda() {
  var x = 1;
  return Unit_getInstance();
}`,
        expected: `import { useState, useEffect } from 'react';
import { Unit_getInstance3abc as Unit_getInstance } from './stdlib.mjs';
function App$lambda() {
  let [count, setCount] = useState(0);


  useEffect(() => {
  var x = 1;

}, []);
}
function _App$lambda$lambda() {
  var x = 1;

}`,
    },

    {
        name: 'keeps the useState tuple when it is read beyond its two indexes',
        input: `import { useState as useState } from 'react';
function useModeState() {
  'use memo';
  var delegate = useState(0);
  var mode = delegate[0];
  var setMode = delegate[1];
  return delegate;
}`,
        expected: `import { useState as useState } from 'react';
function useModeState() {
  'use memo';
  var delegate = useState(0);
  var mode = delegate[0];
  var setMode = delegate[1];
  return delegate;
}`,
    },

    {
        name: 'destructures a useState tuple whose temporary name Kotlin reuses in a nested block',
        input: `import { useState as useState } from 'react';
function useRange(values) {
  'use memo';
  var _destruct__k2r9zo = useState(null);
  var active = _destruct__k2r9zo[0];
  var setActive = _destruct__k2r9zo[1];
  if (active != null) {
    var _destruct__k2r9zo = values.pair();
    var first = _destruct__k2r9zo.first;
  }
  return active;
}`,
        expected: `import { useState as useState } from 'react';
function useRange(values) {
  'use memo';
  let [active, setActive] = useState(null);


  if (active != null) {
    var _destruct__k2r9zo = values.pair();
    var first = _destruct__k2r9zo.first;
  }
  return active;
}`,
    },

    {
        name: 'rewrites nested var and destructures useState(x)[0]',
        input: `import { useState as useState } from 'react';
function useFilteredLabels(items, prefix) {
  'use memo';
  var tmp$ret$0 = toString(trim(prefix));
  var normalizedPrefix = useState(tmp$ret$0)[0];
  var tmp;
  if (charSequenceLength(normalizedPrefix) > 0) {
    var destination = ArrayList().new_kotlin_collections_ArrayList_h94ppk_k$();
    tmp = copyToArray(destination);
  } else {
    tmp = items;
  }
  return tmp;
}`,
        expected: `import { useState as useState } from 'react';
function useFilteredLabels(items, prefix) {
  'use memo';
  var tmp$ret$0 = toString(trim(prefix));
  let [normalizedPrefix] = useState(tmp$ret$0);
  var tmp;
  if (charSequenceLength(normalizedPrefix) > 0) {
    var destination = ArrayList().new_kotlin_collections_ArrayList_h94ppk_k$();
    tmp = copyToArray(destination);
  } else {
    tmp = items;
  }
  return tmp;
}`,
    },

    {
        name: 'inlines a lifted useMemo callback and keeps useCallback returns',
        input: `import {
  useMemo as useMemo,
  useCallback as useCallback,
} from 'react';
import { Unit_getInstanceu5z48rdn3d6z as Unit_getInstance } from '../../../kotlin-kotlin-stdlib/kotlin/Unit.mjs';
function useSearchResults(items, onSelect) {
  'use memo';
  var defaultHeader = useMemo(useSearchResults$lambda, []);
  var handleSelectIndex = useCallback((index) => {
    onSelect(getOrNull(items, index) ?? defaultHeader);
    return Unit_getInstance();
  }, [items, onSelect]);
  return to(items, handleSelectIndex);
}
function useSearchResults$lambda() {
  return 'Results';
}`,
        expected: `import {
  useMemo as useMemo,
  useCallback as useCallback,
} from 'react';
import { Unit_getInstanceu5z48rdn3d6z as Unit_getInstance } from '../../../kotlin-kotlin-stdlib/kotlin/Unit.mjs';
function useSearchResults(items, onSelect) {
  'use memo';
  var defaultHeader = useMemo(() => {
  return 'Results';
}, []);
  var handleSelectIndex = useCallback((index) => {
    onSelect(getOrNull(items, index) ?? defaultHeader);
    return Unit_getInstance();
  }, [items, onSelect]);
  return to(items, handleSelectIndex);
}
function _useSearchResults$lambda() {
  return 'Results';
}`,
    },

    {
        name: 'prefixes hook lambdas and wraps slambda hook arguments in inline arrows',
        input: `import { useState as useState } from 'react';
import { useEffect1jlgi6hiv8qwn as useEffect } from '../../../kotlin-react/react/useEffect.mjs';
function usePolledItems(items, onTick) {
  var _destruct__k2r9zo = useState(0);
  var tickCount = _destruct__k2r9zo[0];
  var setTickCount = _destruct__k2r9zo[1];
  useEffect([items, onTick], usePolledItems$slambda(items, setTickCount, onTick));
  return to(items, () => {
    setTickCount(usePolledItems$lambda$lambda);
    return Unit_getInstance();
  });
}
function usePolledItems$slambda($items, $setTickCount, $onTick) {
  return constructCallableReference(($this$useEffect, $completion) => orPromise($completion, function *($completion) {
    $setTickCount(usePolledItems$slambda$lambda);
    return Unit_getInstance();
  }), 1);
}
function usePolledItems$slambda$lambda(it) {
  return it + 1 | 0;
}
function usePolledItems$lambda$lambda(it) {
  return it + 1 | 0;
}`,
        expected: `import { useState as useState } from 'react';
import { useEffect1jlgi6hiv8qwn as useEffect } from '../../../kotlin-react/react/useEffect.mjs';
function usePolledItems(items, onTick) {
  let [tickCount, setTickCount] = useState(0);


  useEffect([items, onTick], ($this$useEffect, $completion) => _usePolledItems$slambda(items, setTickCount, onTick)($this$useEffect, $completion));
  return to(items, () => {
    setTickCount(_usePolledItems$lambda$lambda);
    return Unit_getInstance();
  });
}
function _usePolledItems$slambda($items, $setTickCount, $onTick) {
  return constructCallableReference(($this$useEffect, $completion) => orPromise($completion, function *($completion) {
    $setTickCount(_usePolledItems$slambda$lambda);
    return Unit_getInstance();
  }), 1);
}
function _usePolledItems$slambda$lambda(it) {
  return it + 1 | 0;
}
function _usePolledItems$lambda$lambda(it) {
  return it + 1 | 0;
}`,
    },

    {
        name: 'wraps $ref() calls for useMemo while preserving KCallable $ref metadata for custom hooks',
        input: `import { useMemo as useMemo, useCallback as useCallback } from 'react';
import { constructCallableReference23y65rf941mch as constructCallableReference } from './reflectRuntime.mjs';
function usePopupSettings(item) {
  'use memo';
  var settings = useMemo(getPopupSettings$ref(), []);
  var service = useService('admin', AdminService$_init_$ref());
  var tmp = () => item.id;
  var cb = useCallback(tmp, [item]);
  return [settings, service, cb];
}
function getPopupSettings$ref() {
  return constructCallableReference(() => createSettings(), 0, 0, 'sig', 'getPopupSettings');
}
function AdminService$_init_$ref() {
  return constructCallableReference((http) => new AdminService(http), 1, 0, 'sig', '<init>');
}`,
        expected: `import { useMemo as useMemo, useCallback as useCallback } from 'react';
import { constructCallableReference23y65rf941mch as constructCallableReference } from './reflectRuntime.mjs';
function usePopupSettings(item) {
  'use memo';
  var settings = useMemo(() => getPopupSettings$ref()(), []);
  var service = useService('admin', AdminService$_init_$ref());

  var cb = useCallback(() => item.id, [item]);
  return [settings, service, cb];
}
function getPopupSettings$ref() {
  return constructCallableReference(() => createSettings(), 0, 0, 'sig', 'getPopupSettings');
}
function AdminService$_init_$ref() {
  return constructCallableReference((http) => new AdminService(http), 1, 0, 'sig', '<init>');
}`,
    },

    {
        name: 'inlines getLocalDelegateReference .current getters and setters',
        input: `import { useRef as useRef } from 'react';
import { getLocalDelegateReference2ls94nvl5ojb2 as getLocalDelegateReference } from './reflectRuntime.mjs';
import { Unit_getInstanceu5z48rdn3d6z as Unit_getInstance } from './Unit.mjs';
function Carousel$lambda(props) {
  _init_properties_Carousel_kt();
  'use memo';
  var isDragging$delegate = useRef(false);
  var onMove = () => {
    if (!invoke$lambda(isDragging$delegate)) {
      invoke$lambda_0(isDragging$delegate, true);
    }
  };
  return onMove;
}
function invoke$lambda($isDragging$delegate) {
  _init_properties_Carousel_kt();
  getLocalDelegateReference('isDragging', KMutableProperty0(), true);
  return $isDragging$delegate.current;
}
function invoke$lambda_0($isDragging$delegate, _set____db54di) {
  _init_properties_Carousel_kt();
  getLocalDelegateReference('isDragging', KMutableProperty0(), true);
  $isDragging$delegate.current = _set____db54di;
  return Unit_getInstance();
}`,
        expected: `import { useRef as useRef } from 'react';
import { getLocalDelegateReference2ls94nvl5ojb2 as getLocalDelegateReference } from './reflectRuntime.mjs';
import { Unit_getInstanceu5z48rdn3d6z as Unit_getInstance } from './Unit.mjs';
function Carousel$lambda(props) {
  'use memo';
  _init_properties_Carousel_kt();

  var isDragging$delegate = useRef(false);
  var onMove = () => {
    if (!isDragging$delegate.current) {
      (isDragging$delegate.current = true);
    }
  };
  return onMove;
}
function invoke$lambda($isDragging$delegate) {
  _init_properties_Carousel_kt();
  getLocalDelegateReference('isDragging', KMutableProperty0(), true);
  return $isDragging$delegate.current;
}
function invoke$lambda_0($isDragging$delegate, _set____db54di) {
  _init_properties_Carousel_kt();
  getLocalDelegateReference('isDragging', KMutableProperty0(), true);
  $isDragging$delegate.current = _set____db54di;
  return Unit_getInstance();
}`,
    },

    {
        name: 'rewrites BigInt literals into BigInt("...") string calls preserving 64-bit Long precision',
        input: `function useTimestamp(ms) {
  'use memo';
  return ms / 1000n + 0n + 9223372036854775807n;
}`,
        expected: `function useTimestamp(ms) {
  'use memo';
  return ms / BigInt('1000') + BigInt('0') + BigInt('9223372036854775807');
}`,
    },

    {
        name: 'destructures indexed useState and .at() useTransition results',
        input: `import {
  useState as useState,
  useTransition as useTransition,
} from 'react';
function DestructuredStateDemo$lambda() {
  'use memo';
  var _destruct__k2r9zo = useState(0);
  // Inline function 'react.StateInstance.component1' call
  var count = _destruct__k2r9zo[0];
  // Inline function 'react.StateInstance.component2' call
  var setCount = _destruct__k2r9zo[1];
  var _destruct__k2r9zo_0 = useTransition();
  var isPending = _destruct__k2r9zo_0.at(0);
  var startTransition = _destruct__k2r9zo_0.at(1);
  var attrs = {};
  attrs.onClick = (it) => {
    startTransition(() => {
      setCount(DestructuredStateDemo$lambda$lambda$lambda$lambda);
      return Unit_getInstance();
    });
    return Unit_getInstance();
  };
  attrs.children = 'Count: ' + count + ' (pending: ' + isPending + ')';
  return jsx('button', attrs);
}
function DestructuredStateDemo$lambda$lambda$lambda$lambda(it) {
  return it + 1 | 0;
}`,
        expected: `import {
  useState as useState,
  useTransition as useTransition,
} from 'react';
function DestructuredStateDemo$lambda() {
  'use memo';
  let [count, setCount] = useState(0);
  // Inline function 'react.StateInstance.component1' call

  // Inline function 'react.StateInstance.component2' call

  let [isPending, startTransition] = useTransition();


  var attrs = {};
  attrs.onClick = (it) => {
    startTransition(() => {
      setCount(_DestructuredStateDemo$lambda$lambda$lambda$lambda);
      return Unit_getInstance();
    });
    return Unit_getInstance();
  };
  attrs.children = 'Count: ' + count + ' (pending: ' + isPending + ')';
  return jsx('button', attrs);
}
function _DestructuredStateDemo$lambda$lambda$lambda$lambda(it) {
  return it + 1 | 0;
}`,
    },

    {
        name: 'drops the trailing Unit return from an inline useEffect arrow',
        input: `import { useEffect as useEffect } from 'react';
import { Unit_getInstanceu5z48rdn3d6z as Unit_getInstance } from '../../../kotlin-kotlin-stdlib/kotlin/Unit.mjs';
function EffectAndGettersDemo$lambda(props) {
  'use memo';
  useEffect(() => {
    console.log('Rendered label:', props.label);
    return Unit_getInstance();
  }, [props.label]);
  return jsx(get_ChildBadge(), { text: props.label });
}`,
        expected: `import { useEffect as useEffect } from 'react';
import { Unit_getInstanceu5z48rdn3d6z as Unit_getInstance } from '../../../kotlin-kotlin-stdlib/kotlin/Unit.mjs';
function EffectAndGettersDemo$lambda(props) {
  'use memo';
  useEffect(() => {
    console.log('Rendered label:', props.label);

  }, [props.label]);
  return jsx(get_ChildBadge(), { text: props.label });
}`,
    },
];

describe('normalizeKotlinMjs', () => {
    for (const {name, input, expected} of normalizeCases) {
        test(name, () => assert.equal(normalize(input), expected));
    }
});

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

    test('compiles hooks with VOID default parameters, BigInt literals, $slambda refs, and omitted stable hook deps', () => {
        const { events } = compileKotlinMjs(`import { useCallback, useRef } from 'react';
import { useEffect1jlgi6hiv8qwn as useEffect } from '../../../kotlin-react/react/useEffect.mjs';
import { constructCallableReference23y65rf941mch as constructCallableReference } from './reflectRuntime.mjs';
export function useAction(value, enabled) {
  enabled = enabled === VOID ? true : enabled;
  'use memo';
  var service = useStableService();
  var opRef = useRef(null);
  useEffect([value, enabled], useAction$slambda(value, opRef));
  return useCallback(() => service.run(value, enabled, 1000n), [value, enabled]);
}
function useAction$slambda($value, $opRef) {
  return constructCallableReference(($this$useEffect, $completion) => {
    $opRef.current = $value;
  }, 1);
}`);
        assert.deepEqual(events.map((e) => e.kind), ['CompileSuccess']);
    });

    test('respects preserveExistingMemoizationGuarantees: true when explicitly enabled', () => {
        const input = `import { useCallback } from 'react';
export function useAction(value) {
  'use memo';
  var service = useStableService();
  return useCallback(() => service.run(value), [value]);
}`;
        assert.deepEqual(compileKotlinMjs(input).events.map((e) => e.kind), ['CompileSuccess']);
        assert.deepEqual(
            compileKotlinMjs(input, 'module.mjs', { preserveExistingMemoizationGuarantees: true }).events.map((e) => e.kind),
            ['CompileError'],
        );
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
});

describe('fast refresh plugin', () => {
    const [compiler, fastRefresh] = reactKotlinJs();

    test('runs after the compiler, on the dev server only', () => {
        assert.deepEqual([compiler.name, fastRefresh.name], ['kotlin-react-compiler', 'vite:react-plugin-kotlinjs']);
        assert.equal(fastRefresh.apply, 'serve');
    });

    test('renames the component getter and switches to the dev JSX runtime', () => {
        const input = `import { jsx } from 'react/jsx-runtime';
function get_App() {
  return App;
}
export {
  get_App as get_App,
};`;
        assert.match(
            fastRefresh.transform.handler(input, 'App.mjs').code,
            /function GetApp\(\) \{[\s\S]*GetApp as get_App[\s\S]*react\/jsx-dev-runtime/,
        );
    });

    test('recognizes lowered components importing kotlin-react/react/jsx/runtime/jsx.mjs', () => {
        const input = `import { jsx2uf3lx2x6pvok as jsx } from '../../../../kotlin-react/react/jsx/runtime/jsx.mjs';
function get_SidebarButton() {
  return SidebarButton;
}
export {
  get_SidebarButton as get_SidebarButton15b2kywczw443,
};`;
        assert.match(
            fastRefresh.transform.handler(input, 'SidebarButton.mjs').code,
            /function GetSidebarButton\(\) \{[\s\S]*GetSidebarButton as get_SidebarButton15b2kywczw443[\s\S]*react\/jsx-dev-runtime/,
        );
    });

    test('skips modules without a component getter', () => {
        assert.equal(fastRefresh.transform.handler('export {};', 'Plain.mjs'), null);
    });
});

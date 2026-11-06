import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import reactKotlinJs, {compileKotlinMjs, normalizeKotlinMjs, projectRequire} from '../dist/index.js';

const normalize = (code) => normalizeKotlinMjs(code).replace(/[ \t]+$/gm, '');

const normalizeCases = [
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
  let x = 1;

}, []);
}
function _App$lambda$lambda() {
  let x = 1;

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
  let tmp$ret$0 = toString(trim(prefix));
  let [normalizedPrefix] = useState(tmp$ret$0);
  let tmp;
  if (charSequenceLength(normalizedPrefix) > 0) {
    let destination = ArrayList().new_kotlin_collections_ArrayList_h94ppk_k$();
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
  let defaultHeader = useMemo(() => {
  return 'Results';
}, []);
  let handleSelectIndex = useCallback((index) => {
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
        name: 'prefixes hook lambdas and slambdas, leaves kotlin-react useEffect alone',
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


  useEffect([items, onTick], _usePolledItems$slambda(items, setTickCount, onTick));
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


  let attrs = {};
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

    test('skips modules without a component getter', () => {
        assert.equal(fastRefresh.transform.handler('export {};', 'Plain.mjs'), null);
    });
});

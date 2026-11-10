/** Kotlin/JS inputs with the output `normalizeKotlinMjs` gives for them; the compiler tests reuse the inputs. */
export const normalizeCases = [
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
        name: 'moves "use no memo" above Kotlin property initialization',
        input: `function useRows(table) {
  _init_properties_Rows_kt__d9zukm();
  'use no memo';
  return table.getRowModel().rows;
}`,
        expected: `function useRows(table) {
  'use no memo';
  _init_properties_Rows_kt__d9zukm();

  return table.getRowModel().rows;
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

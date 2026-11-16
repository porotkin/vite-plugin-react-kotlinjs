/** Kotlin/JS inputs the Babel pre-pass rewrites, with what the compiled code must contain. */
export const stateHookCases = [
    {
        name: 'destructures indexed useState and .at() useTransition results, renaming Kotlin lambda helpers',
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
    });
  };
  attrs.children = 'Count: ' + count + ' (pending: ' + isPending + ')';
  return jsx('button', attrs);
}
function DestructuredStateDemo$lambda$lambda$lambda$lambda(it) {
  return it + 1 | 0;
}`,
        expected: /\[count, setCount\] = useState\(0\);\s+const \[isPending, startTransition\] = useTransition\(\);[\s\S]*setCount\(_DestructuredStateDemo\$lambda\$lambda\$lambda\$lambda\)/,
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
        expected: /const delegate = useState\(0\);/,
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
        // The compiler drops the unused setter.
        expected: /const \[active\] = useState\(null\);/,
    },
    {
        name: 'destructures useState(x)[0]',
        input: `import { useState as useState } from 'react';
function useFilteredLabels(items, prefix) {
  'use memo';
  var tmp$ret$0 = toString(trim(prefix));
  var normalizedPrefix = useState(tmp$ret$0)[0];
  var tmp;
  if (charSequenceLength(normalizedPrefix) > 0) {
    tmp = copyToArray(normalizedPrefix);
  } else {
    tmp = items;
  }
  return tmp;
}`,
        expected: /\[normalizedPrefix\] = useState\(tmp\$ret\$0\);/,
    },
];

export const bigIntLiterals = `import { useCallback } from 'react';
export function useAction(value, enabled) {
  enabled = enabled === VOID ? true : enabled;
  'use memo';
  var service = useStableService();
  return useCallback(() => service.run(value, enabled, 1000n + 9223372036854775807n), [service, value, enabled]);
}`;

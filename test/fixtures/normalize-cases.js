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
        name: 'moves a "use no memo" opt-out above Kotlin property initialization together with "use memo"',
        input: `function TableRow$lambda(props) {
  _init_properties_TableRow_kt__d9zukm();
  'use memo';
  'use no memo';
  return props.row.getVisibleCells();
}`,
        expected: `function TableRow$lambda(props) {
  'use memo';
  'use no memo';
  _init_properties_TableRow_kt__d9zukm();


  return props.row.getVisibleCells();
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
];

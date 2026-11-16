import {
  useMemo as useMemo,
  useEffect as useEffect,
  useState as useState,
  useCallback as useCallback,
  useRef as useRef,
  Fragment as Fragment,
} from 'react';
import { jsxs as jsxs } from 'react/jsx-runtime';
import { VOID3gxj6tk5isa35 as VOID } from '../../kotlin-kotlin-stdlib/kotlin/js/void.mjs';
import { take306tavhandd2q as take } from '../../kotlin-kotlin-stdlib/kotlin/collections/_Arrays.mjs';
import { Unit_getInstanceu5z48rdn3d6z as Unit_getInstance } from '../../kotlin-kotlin-stdlib/kotlin/Unit.mjs';
import { createCleanupCallback25lsm9rsfgs13 as createCleanupCallback } from '../../kotlin-react/react/internal/createCleanupCallback.mjs';
import { ReactHTML_getInstance16d6dkjg7cthd as ReactHTML_getInstance } from '../../kotlin-react-dom/react/dom/html/ReactHTML.mjs';
import { jsx2uf3lx2x6pvok as jsx } from '../../kotlin-react/react/jsx/runtime/jsx.mjs';
import { CoroutineImpl2sn3kjnwmfr10 as CoroutineImpl } from '../../kotlin-kotlin-stdlib/kotlin/coroutines/CoroutineImpl.mjs';
import { protoOf180f3jzyo7rfj as protoOf } from '../../kotlin-kotlin-stdlib/kotlin/js/coreRuntime.mjs';
import { THROW_CCE2g6jy02ryeudk as THROW_CCE } from '../../kotlin-kotlin-stdlib/kotlin/hacks.mjs';
import { CoroutineScopefcb5f5dwqcas as CoroutineScope } from '../../kotlinx-coroutines-core/kotlinx/coroutines/CoroutineScope.mjs';
import { isInterface3d6p8outrmvmk as isInterface } from '../../kotlin-kotlin-stdlib/kotlin/js/typeCheckUtils.mjs';
import { get_COROUTINE_SUSPENDED3ujt3p13qm4iy as get_COROUTINE_SUSPENDED } from '../../kotlin-kotlin-stdlib/kotlin/coroutines/intrinsics/Intrinsics.mjs';
import {
  initMetadataForLambda3af3he42mmnh as initMetadataForLambda,
  initMetadataForCoroutine1i7lbatuf5bnt as initMetadataForCoroutine,
} from '../../kotlin-kotlin-stdlib/kotlin/js/metadataUtils.mjs';
import { constructCallableReference23y65rf941mch as constructCallableReference } from '../../kotlin-kotlin-stdlib/kotlin/js/reflectRuntime.mjs';
import { firstOrNull1982767dljvdy as firstOrNull } from '../../kotlin-kotlin-stdlib/kotlin/collections/_Collections.mjs';
import { yield7e67oxleds6v as yield_0 } from '../../kotlinx-coroutines-core/kotlinx/coroutines/Yield.mjs';
import {
  SuspendFunction118o2kzhbyvufs as SuspendFunction1,
  SuspendFunction032kxzcbrcbtj6 as SuspendFunction0,
} from '../../kotlin-kotlin-stdlib/kotlin/coroutines/kotlin-coroutines-package.mjs';
//region block: imports
//endregion
//region block: pre-declaration
//endregion
function get_TodoList() {
  _init_properties_Sample_kt__5scu0m();
  return TodoList;
}
var TodoList;
function useVisibleItems(items, limit) {
  limit = limit === VOID ? 3 : limit;
  _init_properties_Sample_kt__5scu0m();
  'use memo';
  return useMemo(function () {
    return take(items, limit);
  }, [items, limit]);
}
function useNow(clock) {
  _init_properties_Sample_kt__5scu0m();
  'use memo';
  'use no memo';
  return clock.now();
}
function loadCount($completion) {
  var tmp = new ($loadCountCOROUTINE$())($completion);
  tmp.set_result_xj64lm_k$(Unit_getInstance());
  tmp.set_exception_px07aa_k$(null);
  return tmp.doResume_5yljmg_k$();
}
function useAsyncEffect(key, block) {
  _init_properties_Sample_kt__5scu0m();
  'use memo';
  useEffect(function () {
    return createCleanupCallback(useAsyncEffect$lambda$slambda_0(block, null))();
  }, [key]);
}
function describe(item) {
  _init_properties_Sample_kt__5scu0m();
  return 'Item ' + item;
}
function Heading(title) {
  _init_properties_Sample_kt__5scu0m();
  // Inline function 'react.dom.html.ReactHTML.span' call
  ReactHTML_getInstance();
  // Inline function 'react.IntrinsicType' call
  // Inline function 'js.reflect.unsafeCast' call
  // Inline function 'kotlin.js.unsafeCast' call
  // Inline function 'kotlin.js.asDynamic' call
  var type = 'span';
  var attrs = {};
  attrs.children = title;
  var el = jsx(type, attrs, null);
  return el;
}
function main() {
  _init_properties_Sample_kt__5scu0m();
  console.log(get_TodoList(), useNow({now: function () {
    return 0;
  }}));
}
function TodoList$lambda(props) {
  _init_properties_Sample_kt__5scu0m();
  'use memo';
  var _destruct__k2r9zo = useState(false);
  // Inline function 'react.StateInstance.component1' call
  // Inline function 'kotlin.js.asDynamic' call
  var expanded = _destruct__k2r9zo[0];
  // Inline function 'react.StateInstance.component2' call
  // Inline function 'kotlin.js.asDynamic' call
  var setExpanded = _destruct__k2r9zo[1];
  var visible = useVisibleItems(props.items);
  // Inline function 'kotlin.run' call
  var label = expanded ? 'Collapse' : 'Expand';
  var toggle = useCallback(function () {
    setExpanded(!expanded);
    return Unit_getInstance();
  }, [expanded]);
  useEffect(function () {
    console.log(expanded);
    return undefined;
  }, [expanded]);
  var clicks$delegate = useState(0);
  // Inline function 'react.StateInstance.component1' call
  // Inline function 'kotlin.js.asDynamic' call
  var clicks = clicks$delegate[0];
  // Inline function 'react.StateInstance.component2' call
  // Inline function 'kotlin.js.asDynamic' call
  var setClicks = clicks$delegate[1];
  // Inline function 'react.useRefValue' call
  // Inline function 'js.reflect.unsafeCast' call
  // Inline function 'kotlin.js.unsafeCast' call
  // Inline function 'kotlin.js.asDynamic' call
  var lastItem = useRef('');
  var loaded$delegate = useState(0);
  // Inline function 'react.StateInstance.component1' call
  // Inline function 'kotlin.js.asDynamic' call
  var loaded = loaded$delegate[0];
  // Inline function 'react.StateInstance.component2' call
  // Inline function 'kotlin.js.asDynamic' call
  var setLoaded = loaded$delegate[1];
  var dep = props.title;
  useEffect(function () {
    return createCleanupCallback(TodoList$lambda$lambda$slambda_0(setLoaded, null))();
  }, [dep]);
  useAsyncEffect(expanded, function (completion) {
    return TodoList$lambda$lambda$slambda_2(lastItem, visible, null)(completion);
  });
  var describeItem = useCallback(function (p0) {
    return describe(p0);
  }, []);
  var el = Heading(props.title);
  // Inline function 'react.dom.html.ReactHTML.div' call
  ReactHTML_getInstance();
  // Inline function 'react.IntrinsicType' call
  // Inline function 'js.reflect.unsafeCast' call
  // Inline function 'kotlin.js.unsafeCast' call
  // Inline function 'kotlin.js.asDynamic' call
  var type = 'div';
  // Inline function 'react.dom.html.ReactHTML.button' call
  ReactHTML_getInstance();
  // Inline function 'react.IntrinsicType' call
  // Inline function 'js.reflect.unsafeCast' call
  // Inline function 'kotlin.js.unsafeCast' call
  // Inline function 'kotlin.js.asDynamic' call
  var type_0 = 'button';
  var attrs = {};
  attrs.onClick = function (it) {
    setClicks(clicks + 1 | 0);
    toggle();
    return Unit_getInstance();
  };
  var text = label + ' ' + clicks + ' ' + loaded;
  attrs.children = text;
  var el_0 = jsx(type_0, attrs, '@rdk/wp9u5k/74_8');
  var tmp;
  if (expanded) {
    // Inline function 'react.dom.html.ReactHTML.ul' call
    ReactHTML_getInstance();
    // Inline function 'react.IntrinsicType' call
    // Inline function 'js.reflect.unsafeCast' call
    // Inline function 'kotlin.js.unsafeCast' call
    // Inline function 'kotlin.js.asDynamic' call
    var type_1 = 'ul';
    var children = [];
    var _iterator__ex2g4s = visible.iterator_jk1svi_k$();
    while (_iterator__ex2g4s.hasNext_bitz1p_k$()) {
      var item = _iterator__ex2g4s.next_20eer_k$();
      // Inline function 'react.dom.html.ReactHTML.li' call
      ReactHTML_getInstance();
      // Inline function 'react.IntrinsicType' call
      // Inline function 'js.reflect.unsafeCast' call
      // Inline function 'kotlin.js.unsafeCast' call
      // Inline function 'kotlin.js.asDynamic' call
      var type_2 = 'li';
      // Inline function 'react.Key' call
      // Inline function 'js.reflect.unsafeCast' call
      // Inline function 'kotlin.js.unsafeCast' call
      // Inline function 'kotlin.js.asDynamic' call
      var key = item;
      var text_0 = describeItem(item);
      var attrs_0 = {};
      attrs_0.children = text_0;
      var el_1 = jsx(type_2, attrs_0, key);
      children.push(el_1);
    }
    var attrs_1 = {};
    attrs_1.children = children;
    var el_2 = jsxs(type_1, attrs_1, '@rdk/wp9u5k/83_12');
    tmp = el_2;
  } else {
    tmp = null;
  }
  var el_3 = tmp;
  var attrs_2 = {};
  attrs_2.children = [el_0, el_3];
  var el_4 = jsxs(type, attrs_2, '@rdk/wp9u5k/73_4');
  var attrs_3 = {};
  attrs_3.children = [el, el_4];
  return jsxs(Fragment, attrs_3);
}
var TodoList$lambda$lambda$slambdaClass;
function TodoList$lambda$lambda$slambda() {
  if (TodoList$lambda$lambda$slambdaClass === VOID) {
    initMetadataForLambda($, CoroutineImpl(), VOID, [1]);
    function $($setLoaded, resultContinuation) {
      this.$setLoaded_1 = $setLoaded;
      CoroutineImpl().call(this, resultContinuation);
    }
    protoOf($).invoke_d9fzmj_k$ = function ($this$useEffect, $completion) {
      var tmp = this.create_rcuf4x_k$($this$useEffect, $completion);
      tmp.set_result_xj64lm_k$(Unit_getInstance());
      tmp.set_exception_px07aa_k$(null);
      return tmp.doResume_5yljmg_k$();
    };
    protoOf($).invoke_qns8j1_k$ = function (p1, $completion) {
      return this.invoke_d9fzmj_k$((!(p1 == null) ? isInterface(p1, CoroutineScope()) : false) ? p1 : THROW_CCE(), $completion);
    };
    protoOf($).doResume_5yljmg_k$ = function () {
      var suspendResult = this.get_result_iyg5d2_k$();
      $sm: do
        try {
          var tmp = this.get_state_iypx7s_k$();
          switch (tmp) {
            case 0:
              this.set_exceptionState_fex74n_k$(2);
              this.set_state_rjd8d0_k$(1);
              suspendResult = loadCount(this);
              if (suspendResult === get_COROUTINE_SUSPENDED()) {
                return suspendResult;
              }

              continue $sm;
            case 1:
              var ARGUMENT = suspendResult;
              this.$setLoaded_1(ARGUMENT);
              return Unit_getInstance();
            case 2:
              throw this.get_exception_x0n6w6_k$();
          }
        } catch ($p) {
          var e = $p;
          if (this.get_exceptionState_wflpxn_k$() === 2) {
            throw e;
          } else {
            this.set_state_rjd8d0_k$(this.get_exceptionState_wflpxn_k$());
            this.set_exception_px07aa_k$(e);
          }
        }
       while (true);
    };
    protoOf($).create_rcuf4x_k$ = function ($this$useEffect, completion) {
      var i = new (TodoList$lambda$lambda$slambda())(this.$setLoaded_1, completion);
      i.$this$useEffect_1 = $this$useEffect;
      return i;
    };
    protoOf($).create_wyq9v6_k$ = function (value, completion) {
      return this.create_rcuf4x_k$((!(value == null) ? isInterface(value, CoroutineScope()) : false) ? value : THROW_CCE(), completion);
    };
    TodoList$lambda$lambda$slambdaClass = $;
  }
  return TodoList$lambda$lambda$slambdaClass;
}
function TodoList$lambda$lambda$slambda_0($setLoaded, resultContinuation) {
  var i = new (TodoList$lambda$lambda$slambda())($setLoaded, resultContinuation);
  return constructCallableReference(function ($this$useEffect, $completion) {
    return i.invoke_d9fzmj_k$($this$useEffect, $completion);
  }, 1);
}
var TodoList$lambda$lambda$slambdaClass_0;
function TodoList$lambda$lambda$slambda_1() {
  if (TodoList$lambda$lambda$slambdaClass_0 === VOID) {
    initMetadataForLambda($, CoroutineImpl(), VOID, [0]);
    function $($lastItem, $visible, resultContinuation) {
      this.$lastItem_1 = $lastItem;
      this.$visible_1 = $visible;
      CoroutineImpl().call(this, resultContinuation);
    }
    protoOf($).invoke_h7udsx_k$ = function ($completion) {
      var tmp = this.create_d196fn_k$($completion);
      tmp.set_result_xj64lm_k$(Unit_getInstance());
      tmp.set_exception_px07aa_k$(null);
      return tmp.doResume_5yljmg_k$();
    };
    protoOf($).invoke_ib42db_k$ = function ($completion) {
      return this.invoke_h7udsx_k$($completion);
    };
    protoOf($).doResume_5yljmg_k$ = function () {
      var suspendResult = this.get_result_iyg5d2_k$();
      $sm: do
        try {
          var tmp = this.get_state_iypx7s_k$();
          if (tmp === 0) {
            this.set_exceptionState_fex74n_k$(1);
            var tmp0 = this.$lastItem_1;
            var tmp0_elvis_lhs = firstOrNull(this.$visible_1);
            tmp0.current = tmp0_elvis_lhs == null ? '' : tmp0_elvis_lhs;
            return Unit_getInstance();
          } else if (tmp === 1) {
            throw this.get_exception_x0n6w6_k$();
          }
        } catch ($p) {
          var e = $p;
          throw e;
        }
       while (true);
    };
    protoOf($).create_d196fn_k$ = function (completion) {
      return new (TodoList$lambda$lambda$slambda_1())(this.$lastItem_1, this.$visible_1, completion);
    };
    TodoList$lambda$lambda$slambdaClass_0 = $;
  }
  return TodoList$lambda$lambda$slambdaClass_0;
}
function TodoList$lambda$lambda$slambda_2($lastItem, $visible, resultContinuation) {
  var i = new (TodoList$lambda$lambda$slambda_1())($lastItem, $visible, resultContinuation);
  return constructCallableReference(function ($completion) {
    return i.invoke_h7udsx_k$($completion);
  }, 0);
}
var useAsyncEffect$lambda$slambdaClass;
function useAsyncEffect$lambda$slambda() {
  if (useAsyncEffect$lambda$slambdaClass === VOID) {
    initMetadataForLambda($, CoroutineImpl(), VOID, [1]);
    function $($block, resultContinuation) {
      this.$block_1 = $block;
      CoroutineImpl().call(this, resultContinuation);
    }
    protoOf($).invoke_d9fzmj_k$ = function ($this$useEffect, $completion) {
      var tmp = this.create_rcuf4x_k$($this$useEffect, $completion);
      tmp.set_result_xj64lm_k$(Unit_getInstance());
      tmp.set_exception_px07aa_k$(null);
      return tmp.doResume_5yljmg_k$();
    };
    protoOf($).invoke_qns8j1_k$ = function (p1, $completion) {
      return this.invoke_d9fzmj_k$((!(p1 == null) ? isInterface(p1, CoroutineScope()) : false) ? p1 : THROW_CCE(), $completion);
    };
    protoOf($).doResume_5yljmg_k$ = function () {
      var suspendResult = this.get_result_iyg5d2_k$();
      $sm: do
        try {
          var tmp = this.get_state_iypx7s_k$();
          switch (tmp) {
            case 0:
              this.set_exceptionState_fex74n_k$(2);
              this.set_state_rjd8d0_k$(1);
              suspendResult = this.$block_1(this);
              if (suspendResult === get_COROUTINE_SUSPENDED()) {
                return suspendResult;
              }

              continue $sm;
            case 1:
              return Unit_getInstance();
            case 2:
              throw this.get_exception_x0n6w6_k$();
          }
        } catch ($p) {
          var e = $p;
          if (this.get_exceptionState_wflpxn_k$() === 2) {
            throw e;
          } else {
            this.set_state_rjd8d0_k$(this.get_exceptionState_wflpxn_k$());
            this.set_exception_px07aa_k$(e);
          }
        }
       while (true);
    };
    protoOf($).create_rcuf4x_k$ = function ($this$useEffect, completion) {
      var i = new (useAsyncEffect$lambda$slambda())(this.$block_1, completion);
      i.$this$useEffect_1 = $this$useEffect;
      return i;
    };
    protoOf($).create_wyq9v6_k$ = function (value, completion) {
      return this.create_rcuf4x_k$((!(value == null) ? isInterface(value, CoroutineScope()) : false) ? value : THROW_CCE(), completion);
    };
    useAsyncEffect$lambda$slambdaClass = $;
  }
  return useAsyncEffect$lambda$slambdaClass;
}
function useAsyncEffect$lambda$slambda_0($block, resultContinuation) {
  var i = new (useAsyncEffect$lambda$slambda())($block, resultContinuation);
  return constructCallableReference(function ($this$useEffect, $completion) {
    return i.invoke_d9fzmj_k$($this$useEffect, $completion);
  }, 1);
}
var $loadCountCOROUTINE$Class;
function $loadCountCOROUTINE$() {
  if ($loadCountCOROUTINE$Class === VOID) {
    initMetadataForCoroutine($, CoroutineImpl());
    function $(resultContinuation) {
      CoroutineImpl().call(this, resultContinuation);
    }
    protoOf($).doResume_5yljmg_k$ = function () {
      var suspendResult = this.get_result_iyg5d2_k$();
      $sm: do
        try {
          var tmp = this.get_state_iypx7s_k$();
          switch (tmp) {
            case 0:
              this.set_exceptionState_fex74n_k$(2);
              this.set_state_rjd8d0_k$(1);
              suspendResult = yield_0(this);
              if (suspendResult === get_COROUTINE_SUSPENDED()) {
                return suspendResult;
              }

              continue $sm;
            case 1:
              return 1;
            case 2:
              throw this.get_exception_x0n6w6_k$();
          }
        } catch ($p) {
          var e = $p;
          if (this.get_exceptionState_wflpxn_k$() === 2) {
            throw e;
          } else {
            this.set_state_rjd8d0_k$(this.get_exceptionState_wflpxn_k$());
            this.set_exception_px07aa_k$(e);
          }
        }
       while (true);
    };
    $loadCountCOROUTINE$Class = $;
  }
  return $loadCountCOROUTINE$Class;
}
var properties_initialized_Sample_kt_gh3k30;
function _init_properties_Sample_kt__5scu0m() {
  if (!properties_initialized_Sample_kt_gh3k30) {
    properties_initialized_Sample_kt_gh3k30 = true;
    TodoList = TodoList$lambda;
  }
}
function mainWrapper() {
  main();
}
//region block: exports
export {
  mainWrapper as mainWrapper3st5t1dev50lx,
};
//endregion

//# sourceMappingURL=Sample.mjs.map

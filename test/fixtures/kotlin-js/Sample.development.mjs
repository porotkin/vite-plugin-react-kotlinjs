import {
  useMemo as useMemo,
  useState as useState,
  useCallback as useCallback,
  Fragment as Fragment,
} from 'react';
import { jsxs as jsxs } from 'react/jsx-runtime';
import { VOID3gxj6tk5isa35 as VOID } from '../../kotlin-kotlin-stdlib/kotlin/js/void.mjs';
import { take306tavhandd2q as take } from '../../kotlin-kotlin-stdlib/kotlin/collections/_Arrays.mjs';
import { ReactHTML_getInstance16d6dkjg7cthd as ReactHTML_getInstance } from '../../kotlin-react-dom/react/dom/html/ReactHTML.mjs';
import { jsx2uf3lx2x6pvok as jsx } from '../../kotlin-react/react/jsx/runtime/jsx.mjs';
import { Unit_getInstanceu5z48rdn3d6z as Unit_getInstance } from '../../kotlin-kotlin-stdlib/kotlin/Unit.mjs';
import { useEffect1jlgi6hiv8qwn as useEffect } from '../../kotlin-react/react/useEffect.mjs';
import { CoroutineImpl2sn3kjnwmfr10 as CoroutineImpl } from '../../kotlin-kotlin-stdlib/kotlin/coroutines/CoroutineImpl.mjs';
import { protoOf180f3jzyo7rfj as protoOf } from '../../kotlin-kotlin-stdlib/kotlin/js/coreRuntime.mjs';
import { THROW_CCE2g6jy02ryeudk as THROW_CCE } from '../../kotlin-kotlin-stdlib/kotlin/hacks.mjs';
import { CoroutineScopefcb5f5dwqcas as CoroutineScope } from '../../kotlinx-coroutines-core/kotlinx/coroutines/CoroutineScope.mjs';
import { isInterface3d6p8outrmvmk as isInterface } from '../../kotlin-kotlin-stdlib/kotlin/js/typeCheckUtils.mjs';
import { initMetadataForLambda3af3he42mmnh as initMetadataForLambda } from '../../kotlin-kotlin-stdlib/kotlin/js/metadataUtils.mjs';
import { constructCallableReference23y65rf941mch as constructCallableReference } from '../../kotlin-kotlin-stdlib/kotlin/js/reflectRuntime.mjs';
import { SuspendFunction118o2kzhbyvufs as SuspendFunction1 } from '../../kotlin-kotlin-stdlib/kotlin/coroutines/kotlin-coroutines-package.mjs';
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
function Heading(title) {
  _init_properties_Sample_kt__5scu0m();
  'use memo';
  // Inline function 'react.dom.html.ReactHTML.span' call
  ReactHTML_getInstance();
  // Inline function 'react.IntrinsicType' call
  // Inline function 'js.reflect.unsafeCast' call
  // Inline function 'kotlin.js.unsafeCast' call
  // Inline function 'kotlin.js.asDynamic' call
  var type = 'span';
  var attrs = {};
  attrs.children = title;
  var el = jsx(type, attrs, '@rdk/39_4');
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
  useEffect([expanded], TodoList$lambda$slambda_0(expanded, null));
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
    toggle();
    return Unit_getInstance();
  };
  attrs.children = label;
  var el_0 = jsx(type_0, attrs, '@rdk/51_8');
  var tmp;
  if (expanded) {
    // Inline function 'react.dom.html.ReactHTML.ul' call
    ReactHTML_getInstance();
    // Inline function 'react.IntrinsicType' call
    // Inline function 'js.reflect.unsafeCast' call
    // Inline function 'kotlin.js.unsafeCast' call
    // Inline function 'kotlin.js.asDynamic' call
    var type_1 = 'ul';
    var _iterator__ex2g4s = visible.iterator_jk1svi_k$();
    var list = [];
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
      var attrs_0 = {};
      attrs_0.children = item;
      var el_1 = jsx(type_2, attrs_0, key);
      list.push(el_1);
    }
    var attrs_1 = {};
    attrs_1.children = list;
    var el_2 = jsx(type_1, attrs_1, '@rdk/56_12');
    tmp = el_2;
  } else {
    tmp = null;
  }
  var el_3 = tmp;
  var attrs_2 = {};
  attrs_2.children = [el_0, el_3];
  var el_4 = jsxs(type, attrs_2, '@rdk/50_4');
  var attrs_3 = {};
  attrs_3.children = [el, el_4];
  return jsxs(Fragment, attrs_3);
}
var TodoList$lambda$slambdaClass;
function TodoList$lambda$slambda() {
  if (TodoList$lambda$slambdaClass === VOID) {
    initMetadataForLambda($, CoroutineImpl(), VOID, [1]);
    function $($expanded, resultContinuation) {
      this.$expanded_1 = $expanded;
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
          if (tmp === 0) {
            this.set_exceptionState_fex74n_k$(1);
            console.log(this.$expanded_1);
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
    protoOf($).create_rcuf4x_k$ = function ($this$useEffect, completion) {
      var i = new (TodoList$lambda$slambda())(this.$expanded_1, completion);
      i.$this$useEffect_1 = $this$useEffect;
      return i;
    };
    protoOf($).create_wyq9v6_k$ = function (value, completion) {
      return this.create_rcuf4x_k$((!(value == null) ? isInterface(value, CoroutineScope()) : false) ? value : THROW_CCE(), completion);
    };
    TodoList$lambda$slambdaClass = $;
  }
  return TodoList$lambda$slambdaClass;
}
function TodoList$lambda$slambda_0($expanded, resultContinuation) {
  var i = new (TodoList$lambda$slambda())($expanded, resultContinuation);
  return constructCallableReference(function ($this$useEffect, $completion) {
    return i.invoke_d9fzmj_k$($this$useEffect, $completion);
  }, 1);
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

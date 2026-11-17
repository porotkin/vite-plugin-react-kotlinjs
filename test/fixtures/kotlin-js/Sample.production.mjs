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
import { Unit_instance3kz1zqli6gr1r as Unit_instance } from '../../kotlin-kotlin-stdlib/kotlin/Unit.mjs';
import { createCleanupCallback25lsm9rsfgs13 as createCleanupCallback } from '../../kotlin-react/react/internal/createCleanupCallback.mjs';
import { protoOf180f3jzyo7rfj as protoOf } from '../../kotlin-kotlin-stdlib/kotlin/js/coreRuntime.mjs';
import {
  initMetadataForClassbxx6q50dy2s7 as initMetadataForClass,
  initMetadataForLambda3af3he42mmnh as initMetadataForLambda,
  initMetadataForCoroutine1i7lbatuf5bnt as initMetadataForCoroutine,
} from '../../kotlin-kotlin-stdlib/kotlin/js/metadataUtils.mjs';
import { ReactHTML_instanced0ci4wsv0lrw as ReactHTML_instance } from '../../kotlin-react-dom/react/dom/html/ReactHTML.mjs';
import { jsx2uf3lx2x6pvok as jsx } from '../../kotlin-react/react/jsx/runtime/jsx.mjs';
import { mutableValue2fwfgja1l9ns6 as mutableValue } from '../../kotlin_io_github_porotkin_reactcompiler_annotations/com/github/porotkin/reactcompiler/MutableValue.mjs';
import { CoroutineImpl2sn3kjnwmfr10 as CoroutineImpl } from '../../kotlin-kotlin-stdlib/kotlin/coroutines/CoroutineImpl.mjs';
import { THROW_CCE2g6jy02ryeudk as THROW_CCE } from '../../kotlin-kotlin-stdlib/kotlin/hacks.mjs';
import { CoroutineScopefcb5f5dwqcas as CoroutineScope } from '../../kotlinx-coroutines-core/kotlinx/coroutines/CoroutineScope.mjs';
import { isInterface3d6p8outrmvmk as isInterface } from '../../kotlin-kotlin-stdlib/kotlin/js/typeCheckUtils.mjs';
import { get_COROUTINE_SUSPENDED3ujt3p13qm4iy as get_COROUTINE_SUSPENDED } from '../../kotlin-kotlin-stdlib/kotlin/coroutines/intrinsics/Intrinsics.mjs';
import { constructCallableReference23y65rf941mch as constructCallableReference } from '../../kotlin-kotlin-stdlib/kotlin/js/reflectRuntime.mjs';
import { firstOrNull1982767dljvdy as firstOrNull } from '../../kotlin-kotlin-stdlib/kotlin/collections/_Collections.mjs';
import { yield7e67oxleds6v as yield_0 } from '../../kotlinx-coroutines-core/kotlinx/coroutines/Yield.mjs';
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
  tmp.z3_1 = Unit_instance;
  tmp.a4_1 = null;
  return tmp.f4();
}
function useAsyncEffect(key, block) {
  _init_properties_Sample_kt__5scu0m();
  'use memo';
  useEffect(function () {
    return createCleanupCallback(useAsyncEffect$lambda$slambda_0(block, null))();
  }, [key]);
}
var SelectionClass;
function Selection() {
  if (SelectionClass === VOID) {
    initMetadataForClass($, 'Selection', Selection);
    function $() {
      this.ih_1 = '';
    }
    SelectionClass = $;
  }
  return SelectionClass;
}
function describe(item) {
  _init_properties_Sample_kt__5scu0m();
  return 'Item ' + item;
}
function Heading(title) {
  _init_properties_Sample_kt__5scu0m();
  // Inline function 'react.dom.html.ReactHTML.span' call
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
    return Unit_instance;
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
  var selection = useMemo(function () {
    return new (Selection())();
  }, []);
  useEffect(function () {
    mutableValue(selection).ih_1 = label;
    return undefined;
  }, [clicks]);
  var el = Heading(props.title);
  // Inline function 'react.dom.html.ReactHTML.div' call
  // Inline function 'react.IntrinsicType' call
  // Inline function 'js.reflect.unsafeCast' call
  // Inline function 'kotlin.js.unsafeCast' call
  // Inline function 'kotlin.js.asDynamic' call
  var type = 'div';
  // Inline function 'react.dom.html.ReactHTML.button' call
  // Inline function 'react.IntrinsicType' call
  // Inline function 'js.reflect.unsafeCast' call
  // Inline function 'kotlin.js.unsafeCast' call
  // Inline function 'kotlin.js.asDynamic' call
  var type_0 = 'button';
  var attrs = {};
  attrs.onClick = function (it) {
    setClicks(clicks + 1 | 0);
    toggle();
    return Unit_instance;
  };
  var text = label + ' ' + clicks + ' ' + loaded;
  attrs.children = text;
  var el_0 = jsx(type_0, attrs, '@rdk/wp9u5k/82_8');
  var tmp;
  if (expanded) {
    // Inline function 'react.dom.html.ReactHTML.ul' call
    // Inline function 'react.IntrinsicType' call
    // Inline function 'js.reflect.unsafeCast' call
    // Inline function 'kotlin.js.unsafeCast' call
    // Inline function 'kotlin.js.asDynamic' call
    var type_1 = 'ul';
    var children = [];
    var _iterator__ex2g4s = visible.g();
    while (_iterator__ex2g4s.h()) {
      var item = _iterator__ex2g4s.i();
      // Inline function 'react.dom.html.ReactHTML.li' call
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
    var el_2 = jsxs(type_1, attrs_1, '@rdk/wp9u5k/91_12');
    tmp = el_2;
  } else {
    tmp = null;
  }
  var el_3 = tmp;
  var attrs_2 = {};
  attrs_2.children = [el_0, el_3];
  var el_4 = jsxs(type, attrs_2, '@rdk/wp9u5k/81_4');
  var attrs_3 = {};
  attrs_3.children = [el, el_4];
  return jsxs(Fragment, attrs_3);
}
var TodoList$lambda$lambda$slambdaClass;
function TodoList$lambda$lambda$slambda() {
  if (TodoList$lambda$lambda$slambdaClass === VOID) {
    initMetadataForLambda($, CoroutineImpl(), VOID, [1]);
    function $($setLoaded, resultContinuation) {
      this.rh_1 = $setLoaded;
      CoroutineImpl().call(this, resultContinuation);
    }
    protoOf($).th = function ($this$useEffect, $completion) {
      var tmp = this.uh($this$useEffect, $completion);
      tmp.z3_1 = Unit_instance;
      tmp.a4_1 = null;
      return tmp.f4();
    };
    protoOf($).n4 = function (p1, $completion) {
      return this.th((!(p1 == null) ? isInterface(p1, CoroutineScope()) : false) ? p1 : THROW_CCE(), $completion);
    };
    protoOf($).f4 = function () {
      var suspendResult = this.z3_1;
      $sm: do
        try {
          var tmp = this.x3_1;
          switch (tmp) {
            case 0:
              this.y3_1 = 2;
              this.x3_1 = 1;
              suspendResult = loadCount(this);
              if (suspendResult === get_COROUTINE_SUSPENDED()) {
                return suspendResult;
              }

              continue $sm;
            case 1:
              var ARGUMENT = suspendResult;
              this.rh_1(ARGUMENT);
              return Unit_instance;
            case 2:
              throw this.a4_1;
          }
        } catch ($p) {
          var e = $p;
          if (this.y3_1 === 2) {
            throw e;
          } else {
            this.x3_1 = this.y3_1;
            this.a4_1 = e;
          }
        }
       while (true);
    };
    protoOf($).uh = function ($this$useEffect, completion) {
      var i = new (TodoList$lambda$lambda$slambda())(this.rh_1, completion);
      i.sh_1 = $this$useEffect;
      return i;
    };
    TodoList$lambda$lambda$slambdaClass = $;
  }
  return TodoList$lambda$lambda$slambdaClass;
}
function TodoList$lambda$lambda$slambda_0($setLoaded, resultContinuation) {
  var i = new (TodoList$lambda$lambda$slambda())($setLoaded, resultContinuation);
  return constructCallableReference(function ($this$useEffect, $completion) {
    return i.th($this$useEffect, $completion);
  }, 1);
}
var TodoList$lambda$lambda$slambdaClass_0;
function TodoList$lambda$lambda$slambda_1() {
  if (TodoList$lambda$lambda$slambdaClass_0 === VOID) {
    initMetadataForLambda($, CoroutineImpl(), VOID, [0]);
    function $($lastItem, $visible, resultContinuation) {
      this.di_1 = $lastItem;
      this.ei_1 = $visible;
      CoroutineImpl().call(this, resultContinuation);
    }
    protoOf($).fi = function ($completion) {
      var tmp = this.gi($completion);
      tmp.z3_1 = Unit_instance;
      tmp.a4_1 = null;
      return tmp.f4();
    };
    protoOf($).hi = function ($completion) {
      return this.fi($completion);
    };
    protoOf($).f4 = function () {
      var suspendResult = this.z3_1;
      $sm: do
        try {
          var tmp = this.x3_1;
          if (tmp === 0) {
            this.y3_1 = 1;
            var tmp0 = this.di_1;
            var tmp0_elvis_lhs = firstOrNull(this.ei_1);
            tmp0.current = tmp0_elvis_lhs == null ? '' : tmp0_elvis_lhs;
            return Unit_instance;
          } else if (tmp === 1) {
            throw this.a4_1;
          }
        } catch ($p) {
          var e = $p;
          throw e;
        }
       while (true);
    };
    protoOf($).gi = function (completion) {
      return new (TodoList$lambda$lambda$slambda_1())(this.di_1, this.ei_1, completion);
    };
    TodoList$lambda$lambda$slambdaClass_0 = $;
  }
  return TodoList$lambda$lambda$slambdaClass_0;
}
function TodoList$lambda$lambda$slambda_2($lastItem, $visible, resultContinuation) {
  var i = new (TodoList$lambda$lambda$slambda_1())($lastItem, $visible, resultContinuation);
  return constructCallableReference(function ($completion) {
    return i.fi($completion);
  }, 0);
}
var useAsyncEffect$lambda$slambdaClass;
function useAsyncEffect$lambda$slambda() {
  if (useAsyncEffect$lambda$slambdaClass === VOID) {
    initMetadataForLambda($, CoroutineImpl(), VOID, [1]);
    function $($block, resultContinuation) {
      this.qi_1 = $block;
      CoroutineImpl().call(this, resultContinuation);
    }
    protoOf($).th = function ($this$useEffect, $completion) {
      var tmp = this.uh($this$useEffect, $completion);
      tmp.z3_1 = Unit_instance;
      tmp.a4_1 = null;
      return tmp.f4();
    };
    protoOf($).n4 = function (p1, $completion) {
      return this.th((!(p1 == null) ? isInterface(p1, CoroutineScope()) : false) ? p1 : THROW_CCE(), $completion);
    };
    protoOf($).f4 = function () {
      var suspendResult = this.z3_1;
      $sm: do
        try {
          var tmp = this.x3_1;
          switch (tmp) {
            case 0:
              this.y3_1 = 2;
              this.x3_1 = 1;
              suspendResult = this.qi_1(this);
              if (suspendResult === get_COROUTINE_SUSPENDED()) {
                return suspendResult;
              }

              continue $sm;
            case 1:
              return Unit_instance;
            case 2:
              throw this.a4_1;
          }
        } catch ($p) {
          var e = $p;
          if (this.y3_1 === 2) {
            throw e;
          } else {
            this.x3_1 = this.y3_1;
            this.a4_1 = e;
          }
        }
       while (true);
    };
    protoOf($).uh = function ($this$useEffect, completion) {
      var i = new (useAsyncEffect$lambda$slambda())(this.qi_1, completion);
      i.ri_1 = $this$useEffect;
      return i;
    };
    useAsyncEffect$lambda$slambdaClass = $;
  }
  return useAsyncEffect$lambda$slambdaClass;
}
function useAsyncEffect$lambda$slambda_0($block, resultContinuation) {
  var i = new (useAsyncEffect$lambda$slambda())($block, resultContinuation);
  return constructCallableReference(function ($this$useEffect, $completion) {
    return i.th($this$useEffect, $completion);
  }, 1);
}
var $loadCountCOROUTINE$Class;
function $loadCountCOROUTINE$() {
  if ($loadCountCOROUTINE$Class === VOID) {
    initMetadataForCoroutine($, CoroutineImpl());
    function $(resultContinuation) {
      CoroutineImpl().call(this, resultContinuation);
    }
    protoOf($).f4 = function () {
      var suspendResult = this.z3_1;
      $sm: do
        try {
          var tmp = this.x3_1;
          switch (tmp) {
            case 0:
              this.y3_1 = 2;
              this.x3_1 = 1;
              suspendResult = yield_0(this);
              if (suspendResult === get_COROUTINE_SUSPENDED()) {
                return suspendResult;
              }

              continue $sm;
            case 1:
              return 1;
            case 2:
              throw this.a4_1;
          }
        } catch ($p) {
          var e = $p;
          if (this.y3_1 === 2) {
            throw e;
          } else {
            this.x3_1 = this.y3_1;
            this.a4_1 = e;
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

import assert from 'node:assert/strict';
import { test } from 'node:test';
import reactKotlinJs, { normalizeKotlinMjs } from '../dist/index.js';

test('normalizeKotlinMjs rewrites Kotlin/JS hook patterns', () => {
    const input = `import { useState, useEffect } from 'react';
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
}`;
    assert.equal(
        normalizeKotlinMjs(input).replace(/[ \t]+$/gm, ''),
        `import { useState, useEffect } from 'react';
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
    );
});

test('fast refresh plugin renames the component getter, dev server only', () => {
    const input = `import { jsx } from 'react/jsx-runtime';
function get_App() {
  return App;
}
export {
  get_App as get_App,
};`;
    const fastRefresh = reactKotlinJs();
    assert.equal(fastRefresh.name, 'vite:react-plugin-kotlinjs');
    assert.equal(fastRefresh.apply, 'serve');
    assert.match(
        fastRefresh.transform.handler(input, 'App.mjs').code,
        /function GetApp\(\) \{[\s\S]*GetApp as get_App[\s\S]*react\/jsx-dev-runtime/,
    );
    assert.equal(fastRefresh.transform.handler('export {};', 'Plain.mjs'), null);
});

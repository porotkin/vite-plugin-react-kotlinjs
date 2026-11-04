import assert from 'node:assert/strict';
import { test } from 'node:test';
import reactKotlinJs from '../dist/index.js';

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

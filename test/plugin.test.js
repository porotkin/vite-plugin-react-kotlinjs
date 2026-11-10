import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import reactKotlinJs from '../dist/index.js';

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

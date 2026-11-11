import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import reactKotlinJs from '../dist/index.js';

describe('plugins', () => {
    const [fastRefresh, compiler] = reactKotlinJs();
    const component = `import { jsx2uf3lx2x6pvok as jsx } from '../../../../kotlin-react/react/jsx/runtime/jsx.mjs';
var App;
function App$lambda(props) {
  'use memo';
  return jsx('div', props, null);
}
function get_App() {
  return App;
}
export {
  get_App as get_App1a2b3c,
};`;

    test('run Fast Refresh before the compiler, on the dev server only', () => {
        assert.deepEqual([fastRefresh.name, compiler.name], ['vite:react-plugin-kotlinjs', 'kotlin-react-compiler']);
        assert.equal(fastRefresh.apply, 'serve');
        assert.equal(compiler.apply, undefined);
    });

    test('keep the Fast Refresh rename through the compiler', () => {
        const refreshed = fastRefresh.transform.handler(component, 'App.mjs').code;
        const { code, map } = compiler.transform.handler(refreshed, 'App.mjs');
        assert.match(code, /function GetApp\(\) \{[\s\S]*GetApp as get_App1a2b3c[\s\S]*react\/jsx-dev-runtime/);
        assert.match(code, /react\/compiler-runtime/);
        assert.ok(map.mappings.length > 0);
    });

    test('pass the compiler events of a module to the logger', () => {
        const logged = [];
        const logger = { logEvent: (filename, event) => logged.push(`${filename}: ${event.kind}`) };
        const [, withLogger] = reactKotlinJs({ reactCompiler: { logger } });
        withLogger.transform.handler(component, 'App.mjs');
        assert.deepEqual(logged, ['App.mjs: CompileSuccess']);
    });
});

describe('fast refresh plugin', () => {
    const [fastRefresh] = reactKotlinJs();

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

    test('renames references to the getter inside its module, but not the export alias', () => {
        const input = `import { jsx } from 'react/jsx-runtime';
function get_Tree() {
  return Tree;
}
function Tree$lambda(props) {
  return jsx(get_Tree(), props.child);
}
export {
  get_Tree as get_Tree,
};`;
        const { code } = fastRefresh.transform.handler(input, 'Tree.mjs');
        assert.match(code, /function GetTree\(\) \{/);
        assert.match(code, /jsx\(GetTree\(\), props\.child\)/);
        assert.match(code, /GetTree as get_Tree,/);
    });

    test('skips modules without a component getter', () => {
        assert.equal(fastRefresh.transform.handler('export {};', 'Plain.mjs'), null);
    });

    test('finds the component getter in a long export list in linear time', { timeout: 5000 }, () => {
        const helpers = Array.from({ length: 200 }, (_, i) => `  helper${i} as helper${i}x1y2z3,`).join('\n');
        const exports = (getter) => `import { jsx } from 'react/jsx-runtime';
function get_App() {
  return App;
}
export {
${getter}${helpers}
};`;
        assert.match(fastRefresh.transform.handler(exports('  get_App as get_App1a2b3c,\n'), 'App.mjs').code, /function GetApp\(\) \{/);
        assert.equal(fastRefresh.transform.handler(exports(''), 'Helpers.mjs'), null);
    });
});

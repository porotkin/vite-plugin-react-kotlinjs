import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {normalizeKotlinMjs} from '../dist/index.js';
import {normalizeCases} from './fixtures/normalize-cases.js';

const normalize = (code) => normalizeKotlinMjs(code).replace(/[ \t]+$/gm, '');

describe('normalizeKotlinMjs', () => {
    for (const {name, input, expected} of normalizeCases) {
        test(name, () => assert.equal(normalize(input), expected));
    }
});

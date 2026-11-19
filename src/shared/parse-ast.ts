import { createRequire } from 'node:module';
import type { parseAst as viteParseAst } from 'vite';

const viteRequire = createRequire(createRequire(import.meta.url).resolve('vite'));

export const parseAst: typeof viteParseAst = viteRequire('rolldown/parseAst').parseAst;

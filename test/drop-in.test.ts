/*
 * Portions of this file are derived from the Yargs public API design,
 * behavior, and compatibility test expectations.
 *
 * Yargs is licensed under the MIT License:
 *
 * Copyright 2010 James Halliday (mail@substack.net); Modified work
 * Copyright 2014 Contributors (ben@npmjs.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import realYargs from 'yargs';
import yargs from '../src/index.ts';
import yargsSubpath from '../src/yargs.ts';
import { Parser, applyExtends } from '../src/helpers.ts';

function publicNames(instance: object): Set<string> {
  const names = new Set<string>();
  let current: object | null = instance;
  while (current && current !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(current)) {
      if (!name.startsWith('_')) names.add(name);
    }
    current = Object.getPrototypeOf(current);
  }
  return names;
}

function stripScriptName<T extends Record<string, unknown>>(argv: T): Omit<T, '$0'> {
  const copy = structuredClone(argv);
  delete copy.$0;
  return copy;
}

test('exposes the same public yargs method/property surface', () => {
  const expected = publicNames(realYargs([]));
  const actual = publicNames(yargs([]));
  const missing = [...expected].filter((name) => !actual.has(name)).sort();

  assert.deepEqual(missing, []);
});

test('matches yargs for common unknown option parsing', () => {
  const cases = [
    ['--name', 'Ada', '--no-cache', '-v', '-v', '--nested.value', '42', 'file.txt'],
    ['--foo=99'],
    ['--foo', '001'],
    ['--foo', '-1'],
    ['-abc'],
    ['-n5'],
    ['-x=5'],
    ['-vvv'],
    ['--arr', '1', '--arr', '2'],
    ['--x-y', '1', '--xY', '2'],
    ['--', '--x', '1']
  ];

  for (const args of cases) {
    const expected = realYargs(args).exitProcess(false).parseSync();
    const actual = yargs(args).exitProcess(false).parseSync();
    assert.deepEqual(stripScriptName(actual), stripScriptName(expected), args.join(' '));
  }
});

test('matches yargs parser configuration edge cases', () => {
  const cases = [
    { args: ['--', '--x', '1'], config: { 'populate--': true } },
    { args: ['--x.y', '1'], config: { 'dot-notation': false } },
    { args: ['--x-y', '1'], config: { 'camel-case-expansion': false } },
    { args: ['1', '2'], config: { 'parse-positional-numbers': false } },
    { args: ['--foo', '99'], config: { 'parse-numbers': false } },
    { args: ['--x', '1', '--x', '2'], config: { 'duplicate-arguments-array': false } },
    { args: ['-abc'], config: { 'short-option-groups': false } }
  ];

  for (const { args, config } of cases) {
    const expected = realYargs(args).exitProcess(false).parserConfiguration(config).parseSync();
    const actual = yargs(args).exitProcess(false).parserConfiguration(config).parseSync();
    assert.deepEqual(stripScriptName(actual), stripScriptName(expected), `${args.join(' ')} ${JSON.stringify(config)}`);
  }
});

test('matches yargs for typed option edge cases', () => {
  const scenarios = [
    { args: ['--foo'], setup: (cli) => cli.string('foo') },
    { args: ['--foo'], setup: (cli) => cli.number('foo') },
    { args: ['--foo', '1', '--foo', '2'], setup: (cli) => cli.array('foo') },
    { args: ['--foo', '1', '2'], setup: (cli) => cli.nargs('foo', 2) },
    { args: ['--foo'], setup: (cli) => cli.default('foo', 'bar') },
    { args: ['--foo', 'bar'], setup: (cli) => cli.alias('foo', 'f') },
    { args: ['--foo'], setup: (cli) => cli.alias('foo', 'f') },
    { args: ['-f', 'bar'], setup: (cli) => cli.alias('foo', 'f') },
    { args: ['--foo', 'bar'], setup: (cli) => cli.choices('foo', ['bar', 'baz']) },
    { args: ['--foo', '1'], setup: (cli) => cli.coerce('foo', (value) => Number(value) + 1) },
    { args: ['--arr', '1', '2'], setup: (cli) => cli.array('arr') },
    { args: ['--arr', '1', '2'], setup: (cli) => cli.array('arr').parserConfiguration({ 'greedy-arrays': false }) },
    { args: ['--foo', '1'], setup: (cli) => cli.alias('foo', 'f').parserConfiguration({ 'strip-aliased': true }) },
    { args: ['--foo-bar', '1'], setup: (cli) => cli.parserConfiguration({ 'strip-dashed': true }) }
  ];

  for (const { args, setup } of scenarios) {
    const expected = setup(realYargs(args).exitProcess(false)).parseSync();
    const actual = setup(yargs(args).exitProcess(false)).parseSync();
    assert.deepEqual(stripScriptName(actual), stripScriptName(expected), args.join(' '));
  }
});

test('supports yargs/yargs and helpers subpath compatibility', () => {
  assert.equal(yargsSubpath(['--enabled']).boolean('enabled').parseSync().enabled, true);
  assert.deepEqual(Parser(['--name', 'Ada'], { opts: { name: { type: 'string' } } }).name, 'Ada');
  assert.deepEqual(applyExtends({ ok: true }), { ok: true });
});

test('supports config, env, pkgConf, middleware, normalize and nargs flows', async (t) => {
  const previousEnv = process.env.MCARGS_PORT;
  t.after(() => {
    if (previousEnv === undefined) delete process.env.MCARGS_PORT;
    else process.env.MCARGS_PORT = previousEnv;
  });

  const dir = mkdtempSync(join(tmpdir(), 'mcargs-'));
  const configPath = join(dir, 'config.json');
  writeFileSync(configPath, JSON.stringify({ name: 'Ada', nested: { value: 42 }, file: './a/../b' }));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ mcargs: { debug: true } }));
  process.env.MCARGS_PORT = '3000';

  const argv = await yargs(['--config', configPath, '--pair', 'x', 'y'])
    .config('config')
    .env('MCARGS')
    .pkgConf('mcargs', dir)
    .normalize('file')
    .nargs('pair', 2)
    .middleware((parsed) => ({ fromMiddleware: parsed.name === 'Ada' }), true)
    .parseAsync();

  assert.equal(argv.name, 'Ada');
  assert.deepEqual(argv.nested, { value: 42 });
  assert.equal(argv.port, 3000);
  assert.equal(argv.debug, true);
  assert.equal(argv.file, 'b');
  assert.deepEqual(argv.pair, ['x', 'y']);
  assert.equal(argv.fromMiddleware, true);
});

test('supports commandDir for CommonJS and ESM command modules', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mcargs-commands-'));
  mkdirSync(join(dir, 'commands'));
  writeFileSync(join(dir, 'commands', 'hello.cjs'), `module.exports = { command: 'hello <name>', builder: y => y.positional('name', { type: 'string' }), handler: argv => { argv.greeted = argv.name } }`);
  writeFileSync(join(dir, 'commands', 'bye.mjs'), `export default { command: 'bye <name>', builder: y => y.positional('name', { type: 'string' }), handler: argv => { argv.farewell = argv.name } }`);

  const hello = await yargs(['hello', 'Ada']).commandDir(join(dir, 'commands')).parseAsync();
  assert.equal(hello.name, 'Ada');
  assert.equal(hello.greeted, 'Ada');

  const bye = await yargs(['bye', 'Grace']).commandDir(join(dir, 'commands')).parseAsync();
  assert.equal(bye.name, 'Grace');
  assert.equal(bye.farewell, 'Grace');

  assert.throws(
    () => yargs(['hello', 'Ada']).commandDir(join(dir, 'commands')).parseSync(),
    /use parseAsync\(\)/
  );
});

test('supports additional validation APIs', () => {
  assert.throws(
    () => yargs(['--a', '--b']).boolean(['a', 'b']).conflicts('a', 'b').parseSync(),
    /mutually exclusive/
  );

  assert.throws(
    () => yargs(['--token']).requiresArg('token').parseSync(),
    /requires an argument/
  );

  assert.throws(
    () => yargs(['--write']).boolean('write').implies('write', 'file').parseSync(),
    /implies file/
  );
});

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

test('exposes the same public yargs method/property surface', () => {
  const expected = publicNames(realYargs([]));
  const actual = publicNames(yargs([]));
  const missing = [...expected].filter((name) => !actual.has(name)).sort();

  assert.deepEqual(missing, []);
});

test('matches yargs for common unknown option parsing', () => {
  const args = ['--name', 'Ada', '--no-cache', '-v', '-v', '--nested.value', '42', 'file.txt'];
  const expected = realYargs(args)
    .exitProcess(false)
    .count('v')
    .parseSync();
  const actual = yargs(args)
    .exitProcess(false)
    .count('v')
    .parseSync();

  assert.equal(actual.name, expected.name);
  assert.equal(actual.cache, expected.cache);
  assert.equal(actual.v, expected.v);
  assert.deepEqual(actual.nested, expected.nested);
  assert.deepEqual(actual._, expected._);
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

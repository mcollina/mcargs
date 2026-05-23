import test from 'node:test';
import assert from 'node:assert/strict';
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

import test from 'node:test';
import assert from 'node:assert/strict';
import yargs, { hideBin, McargsError } from '../src/index.ts';
import { hideBin as helperHideBin } from '../src/helpers.ts';

test('parses string, number, boolean, array, default, aliases, and camel-case keys', () => {
  const argv = yargs(['--name', 'Ada', '-p', '42', '--debug', '--tag', 'math', '--tag', 'logic', '--dry-run'])
    .option('name', { type: 'string', demandOption: true })
    .option('port', { type: 'number', alias: 'p', default: 3000 })
    .boolean('debug')
    .array('tag')
    .option('dry-run', { type: 'boolean' })
    .parseSync();

  assert.equal(argv.name, 'Ada');
  assert.equal(argv.port, 42);
  assert.equal(argv.p, 42);
  assert.equal(argv.debug, true);
  assert.deepEqual(argv.tag, ['math', 'logic']);
  assert.equal(argv['dry-run'], true);
  assert.equal(argv.dryRun, true);
});

test('supports choices, coerce, count and check', () => {
  const argv = yargs(['--mode', 'dev', '-v', '-v', '--path', 'src'])
    .option('mode', { type: 'string', choices: ['dev', 'prod'] })
    .count('v')
    .coerce('path', (value) => `/${value}`)
    .string('path')
    .check((parsed) => parsed.mode === 'dev' || 'mode must be dev')
    .parseSync();

  assert.equal(argv.mode, 'dev');
  assert.equal(argv.v, 2);
  assert.equal(argv.path, '/src');
});

test('infers option type from defaults', () => {
  const argv = yargs(['--output', 'result.txt', '--retries', '3'])
    .option('output', { default: 'out.txt' })
    .default('retries', 1)
    .parseSync();

  assert.equal(argv.output, 'result.txt');
  assert.equal(argv.retries, 3);
});

test('throws typed errors for missing required options and invalid choices', () => {
  assert.throws(
    () => yargs([]).option('config', { type: 'string', demandOption: true }).parseSync(),
    (error) => error instanceof McargsError && error.code === 'ERR_MCARGS_MISSING_OPTION'
  );

  assert.throws(
    () => yargs(['--mode', 'test']).option('mode', { type: 'string', choices: ['dev'] }).parseSync(),
    /Expected one of: dev/
  );
});

test('runs command builders, positionals, options and handlers', () => {
  let handled = false;
  const argv = yargs(['serve', '8080', '--host', '127.0.0.1'])
    .command('serve <port>', 'start a server', (cmd) => {
      return cmd
        .positional('port', { type: 'number' })
        .option('host', { type: 'string', default: 'localhost' });
    }, (parsed) => {
      handled = true;
      assert.equal(parsed.port, 8080);
    })
    .parseSync();

  assert.equal(handled, true);
  assert.deepEqual(argv._, ['serve', 8080]);
  assert.equal(argv.port, 8080);
  assert.equal(argv.host, '127.0.0.1');
});

test('detects commands after global boolean options', () => {
  const argv = yargs(['--debug', 'serve'])
    .boolean('debug')
    .command('serve', 'start')
    .parseSync();

  assert.equal(argv.debug, true);
  assert.deepEqual(argv._, ['serve']);
});

test('supports callback parse output for help and version without exiting', () => {
  let help = '';
  const argv = yargs(['--help'])
    .scriptName('demo')
    .usage('Usage: demo <command>')
    .help()
    .option('name', { type: 'string', describe: 'Name to greet' })
    .parse((err, parsed, output) => {
      assert.equal(err, null);
      assert.equal(parsed.help, true);
      help = output;
    });

  assert.equal(argv.help, true);
  assert.match(help, /Usage: demo <command>/);
  assert.match(help, /--name/);
});

test('hideBin removes node and script path', () => {
  const argv = ['/usr/bin/node', '/tmp/cli.ts', '--name', 'Ada'];
  assert.deepEqual(hideBin(argv), ['--name', 'Ada']);
  assert.deepEqual(helperHideBin(argv), ['--name', 'Ada']);
});

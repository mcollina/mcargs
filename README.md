# mcargs

`mcargs` is an ESM, type-stripped TypeScript argument parser that aims to be a drop-in Yargs replacement. Internally it delegates tokenization and option parsing to Node.js [`util.parseArgs()`](https://nodejs.org/api/util.html#utilparseargsconfig), not to Yargs or yargs-parser.

## Requirements

- Node.js 22.19 or newer
- No build step is required for development; supported Node versions run the `.ts` files directly via type stripping.

## Install/use

```js
import yargs, { hideBin } from 'mcargs'

const argv = yargs(hideBin(process.argv))
  .scriptName('demo')
  .usage('Usage: demo [options]')
  .option('name', {
    alias: 'n',
    type: 'string',
    demandOption: true,
    describe: 'Name to greet'
  })
  .number('port')
  .default('port', 3000)
  .help()
  .parseSync()

console.log(argv.name, argv.port)
```

## Yargs-compatible API

The goal is drop-in source compatibility for Yargs users while keeping Node's `util.parseArgs()` as the parsing engine. Supported methods include:

- `option()`, `options()`
- `alias()`, `default()`, `describe()`
- `string()`, `number()`, `boolean()`, `array()`, `count()`
- `choices()`, `coerce()`, `demandOption()` / `required()`
- `command()` with command builders, handlers, and simple `<required>` / `[optional]` positionals
- `positional()`
- `check()`, `fail()`, `strict()`
- `help()`, `version()`, `usage()`, `example()`, `epilog()`, `scriptName()`, `showHelp()`, `getHelp()`
- `parse()`, `parseSync()`, and the `argv` getter
- `hideBin()` helper, also available from `mcargs/helpers`

The full public Yargs method surface is present, including compatibility methods such as `middleware()`, `env()`, `config()`, `completion()`, and `commandDir()`. `commandDir()` uses dynamic `import()` so it can load both CommonJS and ESM command modules; use `parseAsync()` after `commandDir()`.

## Commands

```js
const argv = yargs(['serve', '8080', '--host', '127.0.0.1'])
  .command('serve <port>', 'start a server', (cmd) => {
    return cmd
      .positional('port', { type: 'number' })
      .option('host', { type: 'string', default: 'localhost' })
  }, (argv) => {
    console.log(`listening on ${argv.host}:${argv.port}`)
  })
  .parseSync()
```

## Helpers subpath

```js
import yargs from 'mcargs/yargs'
import { hideBin, Parser, applyExtends } from 'mcargs/helpers'
```

## Development

```sh
npm test
```

Tests use the built-in `node:test` runner.

## License and Yargs attribution

`mcargs` is MIT licensed. It implements the Yargs public interface, and portions are derived from Yargs behavior and public API design. Yargs is not used at runtime; it is only used as a development-time compatibility oracle in tests. The Yargs MIT license is included in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

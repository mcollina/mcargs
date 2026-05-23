# mcargs

`mcargs` is a small ESM, type-stripped TypeScript argument parser with a Yargs-like chainable API. Internally it delegates tokenization and option parsing to Node.js [`util.parseArgs()`](https://nodejs.org/api/util.html#utilparseargsconfig).

## Requirements

- Node.js 24 or newer
- No build step is required for development; Node runs the `.ts` files directly via type stripping.

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

The goal is source familiarity for common Yargs usage while keeping Node's `util.parseArgs()` as the parsing engine. Supported methods include:

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

Some advanced Yargs features are intentionally lightweight or no-op placeholders for compatibility, such as `middleware()`, `env()`, `config()`, `completion()`, and `commandDir()`.

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
import { hideBin } from 'mcargs/helpers'
```

## Development

```sh
npm test
```

Tests use the built-in `node:test` runner.

## License and Yargs attribution

`mcargs` is MIT licensed. It implements a Yargs-like interface, but no Yargs source code was copied or ported into this repository. If that changes in the future, this README should be updated and the Yargs license should be included as requested.

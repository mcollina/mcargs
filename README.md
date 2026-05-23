# mcargs

`mcargs` is an ESM, type-stripped TypeScript argument parser that aims to be a drop-in Yargs replacement while using Node.js [`util.parseArgs()`](https://nodejs.org/api/util.html#utilparseargsconfig) as the parsing engine. Yargs and `yargs-parser` are not used at runtime.

## Requirements

- Node.js 22.19 or newer
- ESM
- No build step is required for development; supported Node versions run the `.ts` files directly via type stripping.

## Install/use

```sh
npm install mcargs
```

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

## Exports

```js
import yargs from 'mcargs'
import yargsAlso from 'mcargs/yargs'
import { hideBin } from 'mcargs'
import { hideBin as hideBinHelper, Parser, applyExtends } from 'mcargs/helpers'
```

| Export | Description |
| --- | --- |
| `mcargs` | Default Yargs-compatible factory. |
| `mcargs/yargs` | Yargs-compatible subpath for code that imports `yargs/yargs`. |
| `hideBin(argv)` | Returns `argv.slice(2)`. |
| `Parser(args, options)` | Compatibility helper modelled after `yargs-parser`. |
| `applyExtends(config)` | Compatibility helper that returns the provided config. |

## Parsing

Use `parseSync()` or the `argv` getter for synchronous CLIs:

```js
const argv = yargs(['--name', 'Ada']).string('name').parseSync()
const same = yargs(['--name', 'Ada']).string('name').argv
```

Use `parse()` when you need the Yargs-style callback overloads:

```js
yargs(['--help'])
  .help()
  .parse((err, argv, output) => {
    if (err) throw err
    if (output) process.stdout.write(output)
  })
```

Use `parseAsync()` when handlers, middleware, completion callbacks, or `commandDir()` need asynchronous work:

```js
const argv = await yargs(['serve'])
  .command('serve', 'start', {}, async (argv) => {
    await startServer(argv)
  })
  .parseAsync()
```

## Options

Define options with `option()` / `options()` or the type helpers.

```js
const argv = yargs(['--name', 'Ada', '-p', '3000', '--tag', 'math', '--tag', 'logic'])
  .option('name', { type: 'string', demandOption: true })
  .option('port', { alias: 'p', type: 'number', default: 8080 })
  .array('tag')
  .boolean('debug')
  .parseSync()
```

Supported option configuration fields:

| Field | Description |
| --- | --- |
| `alias` | One alias or an array of aliases. |
| `array` | Parse as an array. |
| `boolean` | Parse as a boolean. |
| `choices` | Restrict value to a list. |
| `coerce` | Transform a parsed value. |
| `count` | Count boolean occurrences, e.g. `-vvv`. |
| `default` | Default value. Also helps infer type. |
| `demandOption` | Require the option. May be a custom message. |
| `describe` / `description` | Help text. |
| `deprecated` | Mark an option as deprecated. |
| `global` | Mark an option as global. |
| `group` | Help group name. |
| `hidden` | Hide from help unless hidden options are shown. |
| `nargs` | Require multiple values. |
| `normalize` | Normalize path values with `node:path`. |
| `number` | Parse as a number. |
| `requiresArg` | Require an explicit value. |
| `string` | Parse as a string. |
| `type` | One of `string`, `number`, `boolean`, `array`, `count`. |

Type helpers:

```js
yargs(args)
  .string(['name', 'file'])
  .number('port')
  .boolean('verbose')
  .array('tag')
  .count('v')
```

Other option helpers:

```js
yargs(args)
  .alias('port', ['p'])
  .default('port', 3000)
  .describe('port', 'Port to listen on')
  .choices('mode', ['dev', 'prod'])
  .coerce('root', (value) => String(value).trim())
  .demandOption('config')
  .requiresArg('config')
  .nargs('pair', 2)
  .normalize('path')
```

## Commands

Commands support string specs, aliases, builders, handlers, and simple required/optional positionals.

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

Command modules are supported:

```js
yargs(args).command({
  command: 'build [target]',
  aliases: ['b'],
  describe: 'build a target',
  builder: (cmd) => cmd.positional('target', { type: 'string', default: 'app' }),
  handler: (argv) => console.log(argv.target)
})
```

### `commandDir()`

`commandDir()` loads command modules with dynamic `import()`, so it can load both CommonJS and ESM modules (`.js`, `.cjs`, `.mjs` by default). Because dynamic import is asynchronous, call `parseAsync()` after `commandDir()`.

```js
await yargs(hideBin(process.argv))
  .commandDir('./commands')
  .parseAsync()
```

CommonJS command module:

```js
// commands/serve.cjs
module.exports = {
  command: 'serve <port>',
  builder: (yargs) => yargs.number('port'),
  handler: (argv) => console.log(argv.port)
}
```

ESM command module:

```js
// commands/build.mjs
export default {
  command: 'build [target]',
  builder: (yargs) => yargs.string('target'),
  handler: (argv) => console.log(argv.target)
}
```

Options:

```js
await yargs(args)
  .commandDir('./commands', { recurse: true, extensions: ['.mjs', '.cjs'] })
  .parseAsync()
```

Calling `parseSync()` while command modules are still loading throws an error telling you to use `parseAsync()`.

## Config, environment, and package config

### `config()`

`config()` can register a config-file option or merge a config object.

```js
const argv = yargs(['--config', './cli.json'])
  .config('config')
  .parseSync()
```

With a custom parser:

```js
yargs(args).config('config', (file) => parseMyConfig(file))
```

With an inline object:

```js
yargs(args).config({ port: 3000, debug: true })
```

### `env()`

`env(prefix)` reads environment variables and maps them to option names.

```js
// MCARGS_PORT=3000 MCARGS_DEBUG=true
const argv = yargs([])
  .env('MCARGS')
  .number('port')
  .boolean('debug')
  .parseSync()
```

Mapping rules:

- Prefix is removed.
- Names are lower-cased.
- `_` becomes `-`.
- `__` becomes `.`.

### `pkgConf()`

`pkgConf(key, cwd)` reads the nearest `package.json` and merges `packageJson[key]` as defaults.

```json
{
  "mcargs": {
    "port": 3000
  }
}
```

```js
const argv = yargs([]).pkgConf('mcargs', process.cwd()).parseSync()
```

## Validation

```js
yargs(args)
  .demandOption('config')
  .requiresArg('config')
  .conflicts('json', 'yaml')
  .implies('write', 'file')
  .check((argv) => argv.port !== 0 || 'port cannot be 0')
```

Supported validation methods:

| Method | Description |
| --- | --- |
| `demandOption()` / `required()` | Require options. |
| `demand()` / `require()` | Require options or commands depending on argument shape. |
| `demandCommand()` | Require a min/max number of commands. |
| `requiresArg()` | Require an explicit option value. |
| `conflicts()` | Mark options as mutually exclusive. |
| `implies()` | Require one option when another is present. |
| `check()` | Run custom validation. |
| `skipValidation()` | Skip selected validation keys. |

## Middleware

Middleware can run before or after validation.

```js
const argv = await yargs(args)
  .middleware((argv) => ({ startedAt: Date.now() }), true)
  .middleware(async (argv) => {
    await audit(argv)
  })
  .parseAsync()
```

If middleware returns an object, it is merged into `argv`.

## Help, usage, version, and output

```js
yargs(args)
  .scriptName('demo')
  .usage('Usage: demo <command> [options]')
  .example('demo serve --port 3000', 'start the server')
  .epilog('for more information, visit example.com')
  .help()
  .version('1.2.3')
```

Supported output helpers:

- `help()` / `addHelpOpt()`
- `showHelp()` / `getHelp()`
- `showHelpOnFail()`
- `version()` / `showVersion()`
- `usage()` / `usageConfiguration()`
- `example()`
- `epilog()` / `epilogue()`
- `showHidden()` / `addShowHiddenOpt()`
- `completion()` / `getCompletion()` / `showCompletionScript()`
- `wrap()` / `terminalWidth()`

## Parser configuration

`parserConfiguration()` accepts Yargs-style parser configuration keys. Implemented keys include:

| Key | Default | Description |
| --- | --- | --- |
| `camel-case-expansion` | `true` | Also exposes dashed keys as camelCase. |
| `dot-notation` | `true` | Expands dotted keys into nested objects. |
| `boolean-negation` | `true` | Enables `--no-name` for booleans. |
| `populate--` | `false` | When `true`, values after `--` are moved to `argv['--']`. |
| `parse-positional-numbers` | `true` | Converts numeric positionals to numbers. |
| `parse-numbers` | `true` | Converts numeric option values to numbers. |
| `duplicate-arguments-array` | `true` | Repeated unknown options become arrays. |
| `short-option-groups` | `true` | Treats `-abc` as `-a -b -c`; when false it becomes `--abc`. |
| `greedy-arrays` | `true` | Array options consume following positional values until the next option. |
| `nargs-eats-options` | `false` | Allows `nargs()` to consume dash-prefixed values. |
| `strip-aliased` | `false` | Removes alias keys from the final result. |
| `strip-dashed` | `false` | Removes dashed keys when camel-case expansion is enabled. |
| `set-placeholder-key` | `false` | Adds `undefined` placeholders for configured options that were not set. |

```js
const argv = yargs(['--no-cache', '--db.host', 'localhost'])
  .parserConfiguration({ 'populate--': true })
  .parseSync()
```

## Strictness

```js
yargs(args)
  .strict()
  .strictOptions()
  .strictCommands()
```

- `strict()` enables strict option and command checking.
- `strictOptions()` rejects unknown options.
- `strictCommands()` rejects unknown commands when commands are registered.

## Introspection and compatibility methods

The public Yargs method/property surface is present. Compatibility/introspection methods include:

- `$0`, `argv`, `parsed`, `customScriptName`
- `getAliases()`
- `getDemandedCommands()`
- `getDemandedOptions()`
- `getDeprecatedOptions()`
- `getDetectLocale()`
- `getExitProcess()`
- `getGroups()`
- `getInternalMethods()`
- `getOptions()`
- `getStrict()`
- `getStrictCommands()`
- `getStrictOptions()`
- `locale()` / `detectLocale()`
- `exit()` / `exitProcess()`
- `global()`
- `group()`
- `hide()`
- `deprecateOption()`
- `recommendCommands()`
- `updateLocale()` / `updateStrings()`

Some locale and update methods are compatibility hooks because `mcargs` does not bundle Yargs' locale catalog.

## Error handling

Parsing errors throw `McargsError`, which includes a `code` property.

```js
import { McargsError } from 'mcargs'

try {
  yargs([]).demandOption('config').parseSync()
} catch (err) {
  if (err instanceof McargsError) {
    console.error(err.code, err.message)
  }
}
```

Use `fail()` for Yargs-style failure callbacks:

```js
yargs(args)
  .fail((message, error, yargsInstance) => {
    console.error(message)
  })
```

## Development

```sh
npm test
```

Tests use the built-in `node:test` runner. Yargs is a development-only dependency used as a compatibility oracle for API-surface and selected behavioral tests.

CI runs tests on Node.js `22.x`, `24.x`, and `26.x`.

## License and Yargs attribution

`mcargs` is MIT licensed. It implements the Yargs public interface, and portions are derived from Yargs behavior and public API design. Yargs is not used at runtime; it is only used as a development-time compatibility oracle in tests. The Yargs MIT license is included in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

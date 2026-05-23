import { parseArgs } from 'node:util';

export type PrimitiveOptionType = 'string' | 'number' | 'boolean' | 'array' | 'count';

export interface Options {
  alias?: string | string[];
  array?: boolean;
  boolean?: boolean;
  choices?: readonly unknown[];
  coerce?: (value: unknown) => unknown;
  count?: boolean;
  default?: unknown;
  demandOption?: boolean | string;
  describe?: string;
  description?: string;
  global?: boolean;
  hidden?: boolean;
  normalize?: boolean;
  number?: boolean;
  requiresArg?: boolean;
  string?: boolean;
  type?: PrimitiveOptionType;
}

export type OptionsMap = Record<string, Options | PrimitiveOptionType>;
export type PositionalOptions = Omit<Options, 'alias'>;
export type ParseCallback = (err: Error | null, argv: Arguments, output: string) => void;
export type FailCallback = (message: string, error: Error, yargs: Argv) => void;
export type CheckFunction = (argv: Arguments) => boolean | string | void;
export type Builder = ((yargs: Argv) => Argv | void) | OptionsMap;
export type Handler = (argv: Arguments) => void | Promise<void>;

export interface CommandModule {
  command: string | string[];
  aliases?: string | string[];
  describe?: string | false;
  builder?: Builder;
  handler?: Handler;
}

export interface Arguments extends Record<string, unknown> {
  _: Array<string | number>;
  $0: string;
}

export interface Argv {
  argv: Arguments;
  alias(key: string, aliases: string | string[]): this;
  array(keys: string | string[]): this;
  boolean(keys: string | string[]): this;
  check(fn: CheckFunction): this;
  choices(key: string, values: readonly unknown[]): this;
  coerce(key: string, fn: (value: unknown) => unknown): this;
  command(command: string | string[] | CommandModule, describe?: string | false, builder?: Builder, handler?: Handler): this;
  commandDir(): this;
  completion(): this;
  config(): this;
  count(keys: string | string[]): this;
  default(key: string | Record<string, unknown>, value?: unknown): this;
  demandOption(keys: string | string[], message?: string): this;
  describe(key: string | Record<string, string>, description?: string): this;
  detectLocale(): this;
  env(): this;
  epilog(text: string): this;
  example(command: string, description: string): this;
  exitProcess(enabled?: boolean): this;
  fail(fn: FailCallback): this;
  getHelp(): string;
  help(option?: string | boolean, description?: string): this;
  implies(): this;
  locale(): string;
  middleware(): this;
  nargs(): this;
  normalize(): this;
  number(keys: string | string[]): this;
  option(key: string, options?: Options | PrimitiveOptionType): this;
  options(options: OptionsMap): this;
  parse(args?: string | string[] | ParseCallback, context?: unknown, callback?: ParseCallback): Arguments;
  parseSync(args?: string | string[]): Arguments;
  parserConfiguration(config: Record<string, unknown>): this;
  positional(key: string, options?: PositionalOptions): this;
  recommendCommands(): this;
  required(keys: string | string[], message?: string): this;
  scriptName(name: string): this;
  showHelp(output?: (message: string) => void): void;
  strict(enabled?: boolean): this;
  string(keys: string | string[]): this;
  usage(message: string): this;
  version(version?: string | boolean): this;
  wrap(): this;
}

interface OptionDefinition extends Options {
  key: string;
  aliases: string[];
  type: PrimitiveOptionType;
}

interface PositionalDefinition extends PositionalOptions {
  key: string;
  type: PrimitiveOptionType;
}

interface CommandDefinition {
  names: string[];
  display: string;
  description?: string | false;
  positionals: PositionalDefinition[];
  builder?: Builder;
  handler?: Handler;
}

interface ParseState {
  argv: Arguments;
  command?: CommandDefinition;
  output: string;
}

const noopMethods = new Set([
  'commandDir',
  'completion',
  'config',
  'detectLocale',
  'env',
  'implies',
  'middleware',
  'nargs',
  'normalize',
  'recommendCommands',
  'wrap'
]);

export class McargsError extends Error {
  code: string;

  constructor(message: string, code = 'ERR_MCARGS') {
    super(message);
    this.name = 'McargsError';
    this.code = code;
  }
}

class Mcargs implements Argv {
  private args: string[];
  private definitions = new Map<string, OptionDefinition>();
  private positionals: PositionalDefinition[] = [];
  private commands: CommandDefinition[] = [];
  private checks: CheckFunction[] = [];
  private examples: Array<{ command: string; description: string }> = [];
  private usageMessage?: string;
  private epilogMessage?: string;
  private failCallback?: FailCallback;
  private processExit = false;
  private strictMode = false;
  private script = process.argv[1] ? process.argv[1].split('/').at(-1) ?? '$0' : '$0';
  private helpOption?: string;
  private versionOption?: string;
  private versionValue?: string;
  private parserConfig: Record<string, unknown> = {};

  constructor(args: string[] = process.argv.slice(2)) {
    this.args = [...args];
  }

  get argv(): Arguments {
    return this.parseSync();
  }

  option(key: string, options: Options | PrimitiveOptionType = {}): this {
    const incoming = normalizeOptions(options);
    const previous = this.definitions.get(key);
    const aliases = unique([...(previous?.aliases ?? []), ...asArray(incoming.alias)]);
    const type = inferType({ ...previous, ...incoming }, previous?.type);
    this.definitions.set(key, {
      ...previous,
      ...incoming,
      key,
      aliases,
      type
    });
    return this;
  }

  options(options: OptionsMap): this {
    for (const [key, value] of Object.entries(options)) {
      this.option(key, value);
    }
    return this;
  }

  alias(key: string, aliases: string | string[]): this {
    const definition = this.ensureOption(key);
    definition.aliases = unique([...definition.aliases, ...asArray(aliases)]);
    return this;
  }

  default(key: string | Record<string, unknown>, value?: unknown): this {
    if (typeof key === 'string') {
      const definition = this.ensureOption(key);
      definition.default = value;
      definition.type = typeFromDefault(value) ?? definition.type;
    } else {
      for (const [name, defaultValue] of Object.entries(key)) {
        const definition = this.ensureOption(name);
        definition.default = defaultValue;
        definition.type = typeFromDefault(defaultValue) ?? definition.type;
      }
    }
    return this;
  }

  describe(key: string | Record<string, string>, description?: string): this {
    if (typeof key === 'string') {
      this.ensureOption(key).describe = description;
    } else {
      for (const [name, text] of Object.entries(key)) {
        this.ensureOption(name).describe = text;
      }
    }
    return this;
  }

  demandOption(keys: string | string[], message?: string): this {
    for (const key of asArray(keys)) {
      this.ensureOption(key).demandOption = message ?? true;
    }
    return this;
  }

  required(keys: string | string[], message?: string): this {
    return this.demandOption(keys, message);
  }

  choices(key: string, values: readonly unknown[]): this {
    this.ensureOption(key).choices = values;
    return this;
  }

  coerce(key: string, fn: (value: unknown) => unknown): this {
    this.ensureOption(key).coerce = fn;
    return this;
  }

  string(keys: string | string[]): this {
    return this.setType(keys, 'string');
  }

  number(keys: string | string[]): this {
    return this.setType(keys, 'number');
  }

  boolean(keys: string | string[]): this {
    return this.setType(keys, 'boolean');
  }

  array(keys: string | string[]): this {
    return this.setType(keys, 'array');
  }

  count(keys: string | string[]): this {
    return this.setType(keys, 'count');
  }

  command(command: string | string[] | CommandModule, describe?: string | false, builder?: Builder, handler?: Handler): this {
    if (typeof command === 'object' && !Array.isArray(command)) {
      const module = command;
      const registered = makeCommand(module.command, module.describe, module.builder, module.handler);
      registered.names = unique([...registered.names, ...asArray(module.aliases)]);
      this.commands.push(registered);
      return this;
    }

    this.commands.push(makeCommand(command, describe, builder, handler));
    return this;
  }

  positional(key: string, options: PositionalOptions = {}): this {
    const type = inferType(options);
    this.positionals.push({ ...options, key, type });
    return this;
  }

  check(fn: CheckFunction): this {
    this.checks.push(fn);
    return this;
  }

  fail(fn: FailCallback): this {
    this.failCallback = fn;
    return this;
  }

  strict(enabled = true): this {
    this.strictMode = enabled;
    return this;
  }

  parserConfiguration(config: Record<string, unknown>): this {
    this.parserConfig = { ...this.parserConfig, ...config };
    return this;
  }

  help(option: string | boolean = 'help', description = 'Show help'): this {
    if (option === false) {
      if (this.helpOption) this.definitions.delete(this.helpOption);
      this.helpOption = undefined;
      return this;
    }

    this.helpOption = typeof option === 'string' ? option : 'help';
    this.option(this.helpOption, { type: 'boolean', describe: description });
    return this;
  }

  version(version: string | boolean = '0.0.0'): this {
    if (version === false) {
      if (this.versionOption) this.definitions.delete(this.versionOption);
      this.versionOption = undefined;
      this.versionValue = undefined;
      return this;
    }

    this.versionOption = 'version';
    this.versionValue = version;
    this.option(this.versionOption, { type: 'boolean', describe: 'Show version number' });
    return this;
  }

  usage(message: string): this {
    this.usageMessage = message;
    return this;
  }

  example(command: string, description: string): this {
    this.examples.push({ command, description });
    return this;
  }

  epilog(text: string): this {
    this.epilogMessage = text;
    return this;
  }

  scriptName(name: string): this {
    this.script = name;
    return this;
  }

  exitProcess(enabled = true): this {
    this.processExit = enabled;
    return this;
  }

  locale(): string {
    return 'en';
  }

  getHelp(): string {
    const lines: string[] = [];
    lines.push(this.usageMessage ?? `Usage: ${this.script} [options]`);

    if (this.commands.length > 0) {
      lines.push('', 'Commands:');
      for (const command of this.commands) {
        if (command.description === false) continue;
        lines.push(`  ${command.display.padEnd(24)} ${command.description ?? ''}`.trimEnd());
      }
    }

    const visible = [...this.definitions.values()].filter((definition) => !definition.hidden);
    if (visible.length > 0) {
      lines.push('', 'Options:');
      for (const definition of visible) {
        const names = optionNames(definition).join(', ');
        const type = definition.type === 'count' ? 'count' : definition.type;
        const description = definition.describe ?? definition.description ?? '';
        const defaultText = definition.default === undefined ? '' : ` [default: ${String(definition.default)}]`;
        lines.push(`  ${names.padEnd(24)} ${description}${description ? ' ' : ''}[${type}]${defaultText}`.trimEnd());
      }
    }

    if (this.examples.length > 0) {
      lines.push('', 'Examples:');
      for (const example of this.examples) {
        lines.push(`  ${example.command.padEnd(24)} ${example.description}`.trimEnd());
      }
    }

    if (this.epilogMessage) {
      lines.push('', this.epilogMessage);
    }

    return `${lines.join('\n')}\n`;
  }

  showHelp(output: (message: string) => void = console.log): void {
    output(this.getHelp());
  }

  parse(args?: string | string[] | ParseCallback, _context?: unknown, callback?: ParseCallback): Arguments {
    let parseArgsInput: string[] | undefined;
    let cb = callback;

    if (typeof args === 'function') {
      cb = args;
    } else if (args !== undefined) {
      parseArgsInput = splitArgs(args);
    }

    if (typeof _context === 'function') {
      cb = _context as ParseCallback;
    }

    try {
      const state = this.parseState(parseArgsInput ?? this.args);
      if (cb) cb(null, state.argv, state.output);
      return state.argv;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (this.failCallback) this.failCallback(err.message, err, this);
      if (cb) {
        cb(err, emptyArguments(this.script), '');
        return emptyArguments(this.script);
      }
      throw err;
    }
  }

  parseSync(args?: string | string[]): Arguments {
    return this.parse(args);
  }

  private parseState(args: string[]): ParseState {
    const commandMatch = this.findCommand(args);
    if (commandMatch) {
      const { command, index: commandIndex } = commandMatch;
      const commandArgs = removeAt(args, commandIndex);
      const child = this.cloneForCommand(command);
      const state = child.parseWithoutCommand(commandArgs);
      const positionalValues = state.argv._;
      state.argv._ = [command.names[0], ...positionalValues];
      for (const [index, positional] of command.positionals.entries()) {
        const value = positionalValues[index];
        if (value === undefined) {
          if (positional.demandOption) {
            throw new McargsError(`Missing required positional argument: ${positional.key}`, 'ERR_MCARGS_MISSING_POSITIONAL');
          }
          if (positional.default !== undefined) state.argv[positional.key] = positional.default;
          continue;
        }
        state.argv[positional.key] = coerceValue(positional.key, value, positional);
      }
      if (command.handler) command.handler(state.argv);
      return { ...state, command };
    }

    return this.parseWithoutCommand(args);
  }

  private parseWithoutCommand(args: string[]): ParseState {
    const optionConfig = this.toParseArgsOptions();
    let parsed;
    try {
      parsed = parseArgs({
        args,
        options: optionConfig,
        allowPositionals: true,
        strict: this.strictMode,
        tokens: true
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new McargsError(error.message, 'ERR_MCARGS_PARSE');
      }
      throw error;
    }

    const argv = emptyArguments(this.script);
    const values = parsed.values as Record<string, unknown>;
    const consumed = new Set<string>();

    for (const definition of this.definitions.values()) {
      const names = [definition.key, ...definition.aliases, ...implicitAliases(definition.key)];
      let value: unknown;
      for (const name of names) {
        if (Object.hasOwn(values, name)) {
          value = values[name];
          consumed.add(name);
          break;
        }
      }

      if (value === undefined && definition.default !== undefined) {
        value = definition.default;
      }

      if (value === undefined) {
        if (definition.demandOption) {
          const message = typeof definition.demandOption === 'string'
            ? definition.demandOption
            : `Missing required argument: ${definition.key}`;
          throw new McargsError(message, 'ERR_MCARGS_MISSING_OPTION');
        }
        continue;
      }

      value = coerceValue(definition.key, value, definition);
      setArgvValue(argv, definition.key, value);
      for (const alias of definition.aliases) setArgvValue(argv, alias, value);
    }

    for (const [key, value] of Object.entries(values)) {
      if (consumed.has(key) || isImplicitAliasOfKnownOption(key, this.definitions)) continue;
      setArgvValue(argv, key, value);
    }

    argv._ = parsed.positionals.map(toPositionalValue);
    const dashDash = collectDashDash(args);
    if (dashDash && this.parserConfig['populate--'] !== false) {
      argv['--'] = dashDash;
    }

    for (const check of this.checks) {
      const result = check(argv);
      if (result === false) throw new McargsError('Argument check failed', 'ERR_MCARGS_CHECK');
      if (typeof result === 'string') throw new McargsError(result, 'ERR_MCARGS_CHECK');
    }

    let output = '';
    if (this.helpOption && argv[this.helpOption]) {
      output = this.getHelp();
      if (this.processExit) process.exit(0);
    }

    if (this.versionOption && argv[this.versionOption]) {
      output = `${this.versionValue ?? '0.0.0'}\n`;
      if (this.processExit) process.exit(0);
    }

    return { argv, output };
  }

  private findCommand(args: string[]): { command: CommandDefinition; index: number } | undefined {
    const first = firstPositionalToken(args, this.toParseArgsOptions(), this.strictMode);
    if (!first) return undefined;
    const command = this.commands.find((candidate) => candidate.names.includes(first.value));
    return command ? { command, index: first.index } : undefined;
  }

  private cloneForCommand(command: CommandDefinition): Mcargs {
    const child = new Mcargs([]);
    child.definitions = new Map([...this.definitions.entries()].map(([key, value]) => [key, cloneDefinition(value)]));
    child.positionals = command.positionals.map((positional) => ({ ...positional }));
    child.commands = [];
    child.checks = [...this.checks];
    child.examples = [...this.examples];
    child.usageMessage = this.usageMessage;
    child.epilogMessage = this.epilogMessage;
    child.failCallback = this.failCallback;
    child.processExit = this.processExit;
    child.strictMode = this.strictMode;
    child.script = this.script;
    child.helpOption = this.helpOption;
    child.versionOption = this.versionOption;
    child.versionValue = this.versionValue;
    child.parserConfig = { ...this.parserConfig };

    if (command.builder) {
      if (typeof command.builder === 'function') {
        command.builder(child);
      } else {
        child.options(command.builder);
      }
    }

    return child;
  }

  private ensureOption(key: string): OptionDefinition {
    const existing = this.definitions.get(key);
    if (existing) return existing;
    const definition: OptionDefinition = { key, aliases: [], type: 'boolean' };
    this.definitions.set(key, definition);
    return definition;
  }

  private setType(keys: string | string[], type: PrimitiveOptionType): this {
    for (const key of asArray(keys)) {
      const definition = this.ensureOption(key);
      definition.type = type;
      if (type === 'array') definition.array = true;
      if (type === 'boolean') definition.boolean = true;
      if (type === 'count') definition.count = true;
      if (type === 'number') definition.number = true;
      if (type === 'string') definition.string = true;
    }
    return this;
  }

  private toParseArgsOptions(): Record<string, { type: 'string' | 'boolean'; multiple?: boolean; short?: string }> {
    const options: Record<string, { type: 'string' | 'boolean'; multiple?: boolean; short?: string }> = {};

    for (const definition of this.definitions.values()) {
      for (const name of [definition.key, ...definition.aliases, ...implicitAliases(definition.key)]) {
        if (options[name]) continue;
        const parseType = definition.type === 'boolean' || definition.type === 'count' ? 'boolean' : 'string';
        options[name] = { type: parseType };
        if (definition.type === 'array' || definition.type === 'count') options[name].multiple = true;
        if (name.length === 1) options[name].short = name;
      }
    }

    return options;
  }
}

for (const method of noopMethods) {
  Object.defineProperty(Mcargs.prototype, method, {
    value: function noop(this: Mcargs): Mcargs {
      return this;
    }
  });
}

export function yargs(args?: string | string[]): Argv {
  return new Mcargs(args === undefined ? process.argv.slice(2) : splitArgs(args));
}

export function hideBin(argv: string[]): string[] {
  return argv.slice(2);
}

export default yargs;

function normalizeOptions(options: Options | PrimitiveOptionType): Options {
  if (typeof options === 'string') return { type: options };
  return { ...options };
}

function inferType(options: Options, fallback: PrimitiveOptionType = 'boolean'): PrimitiveOptionType {
  if (options.type) return options.type;
  if (options.array) return 'array';
  if (options.count) return 'count';
  if (options.number) return 'number';
  if (options.string) return 'string';
  if (options.boolean) return 'boolean';
  if (Array.isArray(options.default)) return 'array';
  if (typeof options.default === 'number') return 'number';
  if (typeof options.default === 'string') return 'string';
  if (typeof options.default === 'boolean') return 'boolean';
  return fallback;
}

function typeFromDefault(value: unknown): PrimitiveOptionType | undefined {
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'boolean') return 'boolean';
  return undefined;
}

function asArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function splitArgs(args: string | string[]): string[] {
  if (Array.isArray(args)) return [...args];
  return args.trim() === '' ? [] : args.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((arg) => arg.replace(/^(['"])(.*)\1$/, '$2')) ?? [];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function emptyArguments(script: string): Arguments {
  return { _: [], $0: script };
}

function camelCase(value: string): string {
  return value.replace(/-([a-zA-Z0-9])/g, (_match, char: string) => char.toUpperCase());
}

function implicitAliases(key: string): string[] {
  const camel = camelCase(key);
  return camel === key ? [] : [camel];
}

function isImplicitAliasOfKnownOption(key: string, definitions: Map<string, OptionDefinition>): boolean {
  for (const definition of definitions.values()) {
    if (implicitAliases(definition.key).includes(key)) return true;
  }
  return false;
}

function setArgvValue(argv: Arguments, key: string, value: unknown): void {
  argv[key] = value;
  const camel = camelCase(key);
  if (camel !== key) argv[camel] = value;
}

function coerceValue(key: string, value: unknown, definition: Options & { type: PrimitiveOptionType }): unknown {
  let coerced = value;

  if (definition.type === 'array') {
    coerced = Array.isArray(coerced) ? coerced : [coerced];
  } else if (definition.type === 'count') {
    coerced = Array.isArray(coerced) ? coerced.length : coerced === undefined ? 0 : 1;
  } else if (definition.type === 'number') {
    if (Array.isArray(coerced)) {
      coerced = coerced.map((entry) => toNumber(key, entry));
    } else {
      coerced = toNumber(key, coerced);
    }
  } else if (definition.type === 'boolean') {
    if (Array.isArray(coerced)) coerced = coerced.at(-1);
  }

  if (definition.coerce) coerced = definition.coerce(coerced);

  if (definition.choices && !definition.choices.includes(coerced)) {
    throw new McargsError(`Invalid value for ${key}: ${String(coerced)}. Expected one of: ${definition.choices.join(', ')}`, 'ERR_MCARGS_CHOICES');
  }

  return coerced;
}

function toNumber(key: string, value: unknown): number {
  const number = Number(value);
  if (Number.isNaN(number)) throw new McargsError(`Invalid number for ${key}: ${String(value)}`, 'ERR_MCARGS_NUMBER');
  return number;
}

function toPositionalValue(value: string): string | number {
  return /^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : value;
}

function firstPositionalToken(
  args: string[],
  options: Record<string, { type: 'string' | 'boolean'; multiple?: boolean; short?: string }>,
  strict: boolean
): { value: string; index: number } | undefined {
  try {
    const parsed = parseArgs({ args, options, strict, allowPositionals: true, tokens: true });
    const token = parsed.tokens.find((entry) => entry.kind === 'positional');
    return token && 'value' in token ? { value: token.value, index: token.index } : undefined;
  } catch {
    const index = args.findIndex((arg) => arg !== '--' && !arg.startsWith('-'));
    return index === -1 ? undefined : { value: args[index]!, index };
  }
}

function removeAt(args: string[], index: number): string[] {
  const result = [...args];
  result.splice(index, 1);
  return result;
}

function collectDashDash(args: string[]): string[] | undefined {
  const index = args.indexOf('--');
  if (index === -1) return undefined;
  return args.slice(index + 1);
}

function makeCommand(command: string | string[], description?: string | false, builder?: Builder, handler?: Handler): CommandDefinition {
  const commands = asArray(command);
  const names: string[] = [];
  const positionals: PositionalDefinition[] = [];
  let display = commands[0] ?? '';

  for (const commandEntry of commands) {
    const parsed = parseCommandSpec(commandEntry);
    names.push(...parsed.names);
    positionals.push(...parsed.positionals);
  }

  return {
    names: unique(names),
    display,
    description,
    positionals: uniqueByKey(positionals),
    builder,
    handler
  };
}

function parseCommandSpec(spec: string): { names: string[]; positionals: PositionalDefinition[] } {
  const parts = spec.trim().split(/\s+/);
  const commandPart = parts.shift() ?? '';
  const names = commandPart.split(/[|,]/).filter(Boolean);
  const positionals = parts.flatMap((part) => {
    const required = part.startsWith('<') && part.endsWith('>');
    const optional = part.startsWith('[') && part.endsWith(']');
    if (!required && !optional) return [];
    return [{ key: part.slice(1, -1), demandOption: required, type: 'string' as const }];
  });

  return { names, positionals };
}

function uniqueByKey(values: PositionalDefinition[]): PositionalDefinition[] {
  const seen = new Set<string>();
  const result: PositionalDefinition[] = [];
  for (const value of values) {
    if (seen.has(value.key)) continue;
    seen.add(value.key);
    result.push(value);
  }
  return result;
}

function cloneDefinition(definition: OptionDefinition): OptionDefinition {
  return {
    ...definition,
    aliases: [...definition.aliases],
    choices: definition.choices ? [...definition.choices] : undefined
  };
}

function optionNames(definition: OptionDefinition): string[] {
  return [definition.key, ...definition.aliases]
    .map((name) => (name.length === 1 ? `-${name}` : `--${name}`));
}

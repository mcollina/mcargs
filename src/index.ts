import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize as normalizePath, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const require = createRequire(import.meta.url);

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
  deprecated?: string | boolean;
  describe?: string;
  description?: string;
  global?: boolean;
  group?: string;
  hidden?: boolean;
  nargs?: number;
  normalize?: boolean;
  number?: boolean;
  requiresArg?: boolean;
  string?: boolean;
  type?: PrimitiveOptionType;
}

export type OptionsMap = Record<string, Options | PrimitiveOptionType>;
export type KeyInput = string | string[];
export type Dictionary<T = unknown> = Record<string, T>;
export type PositionalOptions = Omit<Options, 'alias'>;
export type ParseCallback = (err: Error | null, argv: Arguments, output: string) => void;
export type FailCallback = (message: string, error: Error, yargs: Argv) => void;
export type CheckFunction = (argv: Arguments) => boolean | string | void;
export type Builder = ((yargs: Argv) => Argv | void) | OptionsMap;
export type Handler = (argv: Arguments) => void | Promise<void>;
export type MiddlewareFunction = (argv: Arguments) => void | Dictionary | Promise<void | Dictionary>;
export type ConfigParseFunction = (configPath: string) => Dictionary;

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
  addHelpOpt(option?: string | boolean, description?: string): this;
  addShowHiddenOpt(option?: string | boolean, description?: string): this;
  commandDir(directory: string, options?: { extensions?: string[]; recurse?: boolean }): this;
  commands(command: string | string[] | CommandModule, describe?: string | false, builder?: Builder, handler?: Handler): this;
  completion(command?: string, description?: string, fn?: (current: string, argv: Arguments) => string[] | Promise<string[]>): this;
  config(key?: string | Dictionary | boolean, description?: string | ConfigParseFunction, parseFn?: ConfigParseFunction): this;
  conflicts(key: string | Dictionary<string | string[]>, value?: string | string[]): this;
  count(keys: string | string[]): this;
  default(key: string | Record<string, unknown>, value?: unknown): this;
  defaults(key: string | Record<string, unknown>, value?: unknown): this;
  demand(keys?: string | string[] | number, max?: number | string, msg?: string): this;
  demandCommand(min?: number, max?: number, minMsg?: string, maxMsg?: string): this;
  demandOption(keys: string | string[], message?: string): this;
  deprecateOption(key: string, message?: string): this;
  describe(key: string | Record<string, string>, description?: string): this;
  detectLocale(enabled?: boolean): this;
  env(prefix?: string | false): this;
  epilog(text: string): this;
  epilogue(text: string): this;
  example(command: string, description: string): this;
  exit(code?: number, error?: Error): void;
  exitProcess(enabled?: boolean): this;
  fail(fn: FailCallback): this;
  getAliases(): Dictionary<string[]>;
  getCompletion(args: string[], done: (completions: string[]) => void): void;
  getDemandedCommands(): Dictionary<unknown>;
  getDemandedOptions(): string[];
  getDeprecatedOptions(): Dictionary<string | boolean>;
  getDetectLocale(): boolean;
  getExitProcess(): boolean;
  getGroups(): Dictionary<string[]>;
  getHelp(): string;
  getOptions(): Dictionary<unknown>;
  getStrict(): boolean;
  getStrictCommands(): boolean;
  getStrictOptions(): boolean;
  global(keys: string | string[], global?: boolean): this;
  group(keys: string | string[], groupName: string): this;
  help(option?: string | boolean, description?: string): this;
  hide(key: string): this;
  implies(key: string | Dictionary<string | string[]>, value?: string | string[]): this;
  locale(locale?: string): string | this;
  middleware(callbacks: MiddlewareFunction | MiddlewareFunction[], applyBeforeValidation?: boolean): this;
  nargs(key: string | Dictionary<number>, count?: number): this;
  normalize(keys: string | string[]): this;
  number(keys: string | string[]): this;
  option(key: string, options?: Options | PrimitiveOptionType): this;
  options(options: OptionsMap): this;
  parse(args?: string | string[] | ParseCallback, context?: unknown, callback?: ParseCallback): Arguments;
  parseAsync(args?: string | string[]): Promise<Arguments>;
  parseSync(args?: string | string[]): Arguments;
  parserConfiguration(config: Record<string, unknown>): this;
  pkgConf(key: string, cwd?: string): this;
  positional(key: string, options?: PositionalOptions): this;
  recommendCommands(): this;
  require(keys?: string | string[] | number, max?: number | string, msg?: string): this;
  required(keys: string | string[], message?: string): this;
  requiresArg(keys: string | string[]): this;
  scriptName(name: string): this;
  showCompletionScript(output?: (message: string) => void): void;
  showHelp(output?: (message: string) => void): void;
  showHelpOnFail(enabled?: boolean, message?: string): this;
  showHidden(option?: string | boolean, description?: string): this;
  showVersion(output?: (message: string) => void): void;
  skipValidation(keys?: string | string[]): this;
  strict(enabled?: boolean): this;
  strictCommands(enabled?: boolean): this;
  strictOptions(enabled?: boolean): this;
  string(keys: string | string[]): this;
  terminalWidth(width?: number): number;
  usage(message: string): this;
  usageConfiguration(config: Dictionary): this;
  version(version?: string | boolean): this;
  wrap(width?: number | null): this;
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
  'recommendCommands',
  'updateLocale',
  'updateStrings'
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
  private conflictsMap = new Map<string, string[]>();
  private implications = new Map<string, string[]>();
  private demandedCommandMin?: number;
  private demandedCommandMax?: number;
  private demandedCommandMinMessage?: string;
  private demandedCommandMaxMessage?: string;
  private groupMap = new Map<string, string[]>();
  private skippedValidation = new Set<string>();
  private configObjects: Dictionary[] = [];
  private configDefinitions: Array<{ key: string; parse?: ConfigParseFunction }> = [];
  private envPrefix?: string;
  private pkgConfEntries: Array<{ key: string; cwd: string }> = [];
  private middlewareBeforeValidation: MiddlewareFunction[] = [];
  private middlewareAfterValidation: MiddlewareFunction[] = [];
  private completionFunction?: (current: string, argv: Arguments) => string[] | Promise<string[]>;
  private usageMessage?: string;
  private epilogMessage?: string;
  private failCallback?: FailCallback;
  private processExit = false;
  private strictMode = false;
  private strictOptionMode = false;
  private strictCommandMode = false;
  private showHiddenOptions = false;
  private detectLocaleEnabled = true;
  private localeValue = 'en';
  private showHelpOnFailEnabled = true;
  private showHelpOnFailMessage?: string;
  private completionCommand = 'completion';
  private wrapWidth?: number;
  private lastHandlerResult?: void | Promise<void>;
  private script = process.argv[1] ? process.argv[1].split('/').at(-1) ?? '$0' : '$0';
  private helpOption?: string;
  private versionOption?: string;
  private versionValue?: string;
  private parserConfig: Record<string, unknown> = { 'camel-case-expansion': true, 'dot-notation': true, 'boolean-negation': true, 'populate--': false };

  constructor(args: string[] = process.argv.slice(2)) {
    this.args = [...args];
  }

  get $0(): string {
    return this.script;
  }

  get customScriptName(): boolean {
    return this.script !== (process.argv[1] ? process.argv[1].split('/').at(-1) ?? '$0' : '$0');
  }

  get parsed(): Arguments {
    return this.parseSync();
  }

  get argv(): Arguments {
    return this.parseSync();
  }

  option(key: string | string[] | OptionsMap, options: Options | PrimitiveOptionType = {}): this {
    if (Array.isArray(key)) {
      for (const name of key) this.option(name, options);
      return this;
    }

    if (typeof key === 'object') {
      return this.options(key);
    }

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

  alias(key: string | Dictionary<string | string[]>, aliases?: string | string[]): this {
    if (typeof key === 'object') {
      for (const [name, aliasValue] of Object.entries(key)) this.alias(name, aliasValue);
      return this;
    }

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

  defaults(key: string | Record<string, unknown>, value?: unknown): this {
    return this.default(key, value);
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

  demand(keys?: string | string[] | number, max?: number | string, msg?: string): this {
    if (typeof keys === 'number') return this.demandCommand(keys, typeof max === 'number' ? max : undefined, typeof max === 'string' ? max : msg);
    if (keys === undefined) return this.demandCommand(1);
    return this.demandOption(keys, typeof max === 'string' ? max : msg);
  }

  require(keys?: string | string[] | number, max?: number | string, msg?: string): this {
    return this.demand(keys, max, msg);
  }

  demandCommand(min = 1, max?: number, minMsg?: string, maxMsg?: string): this {
    this.demandedCommandMin = min;
    this.demandedCommandMax = max;
    this.demandedCommandMinMessage = minMsg;
    this.demandedCommandMaxMessage = maxMsg;
    return this;
  }

  required(keys: string | string[], message?: string): this {
    return this.demandOption(keys, message);
  }

  requiresArg(keys: string | string[]): this {
    for (const key of asArray(keys)) this.ensureOption(key).requiresArg = true;
    return this;
  }

  deprecateOption(key: string, message: string | boolean = true): this {
    this.ensureOption(key).deprecated = message;
    return this;
  }

  choices(key: string | Dictionary<readonly unknown[]>, values?: readonly unknown[]): this {
    if (typeof key === 'object') {
      for (const [name, choiceValues] of Object.entries(key)) this.choices(name, choiceValues);
      return this;
    }

    this.ensureOption(key).choices = values ?? [];
    return this;
  }

  coerce(key: string | Dictionary<(value: unknown) => unknown>, fn?: (value: unknown) => unknown): this {
    if (typeof key === 'object') {
      for (const [name, coerceFn] of Object.entries(key)) this.coerce(name, coerceFn);
      return this;
    }

    if (fn) this.ensureOption(key).coerce = fn;
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

  global(keys: string | string[], global = true): this {
    for (const key of asArray(keys)) this.ensureOption(key).global = global;
    return this;
  }

  group(keys: string | string[], groupName: string): this {
    const entries = asArray(keys);
    this.groupMap.set(groupName, unique([...(this.groupMap.get(groupName) ?? []), ...entries]));
    for (const key of entries) this.ensureOption(key).group = groupName;
    return this;
  }

  hide(key: string): this {
    this.ensureOption(key).hidden = true;
    return this;
  }

  conflicts(key: string | Dictionary<string | string[]>, value?: string | string[]): this {
    if (typeof key === 'object') {
      for (const [name, conflictsWith] of Object.entries(key)) this.conflicts(name, conflictsWith);
      return this;
    }
    this.conflictsMap.set(key, unique([...(this.conflictsMap.get(key) ?? []), ...asArray(value)]));
    return this;
  }

  implies(key: string | Dictionary<string | string[]>, value?: string | string[]): this {
    if (typeof key === 'object') {
      for (const [name, implied] of Object.entries(key)) this.implies(name, implied);
      return this;
    }
    this.implications.set(key, unique([...(this.implications.get(key) ?? []), ...asArray(value)]));
    return this;
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

  commands(command: string | string[] | CommandModule, describe?: string | false, builder?: Builder, handler?: Handler): this {
    return this.command(command, describe, builder, handler);
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
    this.strictOptionMode = enabled;
    this.strictCommandMode = enabled;
    return this;
  }

  strictOptions(enabled = true): this {
    this.strictOptionMode = enabled;
    this.strictMode = enabled || this.strictCommandMode;
    return this;
  }

  strictCommands(enabled = true): this {
    this.strictCommandMode = enabled;
    this.strictMode = enabled || this.strictOptionMode;
    return this;
  }

  parserConfiguration(config: Record<string, unknown>): this {
    this.parserConfig = { ...this.parserConfig, ...config };
    return this;
  }

  config(key: string | Dictionary | boolean = 'config', description?: string | ConfigParseFunction, parseFn?: ConfigParseFunction): this {
    if (key === false) return this;
    if (typeof key === 'object') {
      this.configObjects.push(key);
      return this;
    }

    const optionKey = key === true ? 'config' : key;
    const parser = typeof description === 'function' ? description : parseFn;
    this.configDefinitions.push({ key: optionKey, parse: parser });
    this.option(optionKey, {
      type: 'string',
      describe: typeof description === 'string' ? description : 'Path to JSON config file'
    });
    return this;
  }

  env(prefix?: string | false): this {
    if (prefix === false) {
      this.envPrefix = undefined;
      return this;
    }
    this.envPrefix = prefix ?? '';
    return this;
  }

  pkgConf(key: string, cwd = process.cwd()): this {
    this.pkgConfEntries.push({ key, cwd });
    return this;
  }

  middleware(callbacks: MiddlewareFunction | MiddlewareFunction[], applyBeforeValidation = false): this {
    const target = applyBeforeValidation ? this.middlewareBeforeValidation : this.middlewareAfterValidation;
    target.push(...asArray(callbacks));
    return this;
  }

  nargs(key: string | Dictionary<number>, count?: number): this {
    if (typeof key === 'object') {
      for (const [name, value] of Object.entries(key)) this.nargs(name, value);
      return this;
    }
    const definition = this.ensureOption(key);
    definition.nargs = count;
    if (definition.type === 'boolean' && !definition.boolean) definition.type = 'string';
    return this;
  }

  normalize(keys: string | string[]): this {
    for (const key of asArray(keys)) this.ensureOption(key).normalize = true;
    return this;
  }

  detectLocale(enabled = true): this {
    this.detectLocaleEnabled = enabled;
    return this;
  }

  completion(command = 'completion', _description?: string, fn?: (current: string, argv: Arguments) => string[] | Promise<string[]>): this {
    this.completionCommand = command;
    this.completionFunction = fn;
    return this;
  }

  commandDir(directory: string, options: { extensions?: string[]; recurse?: boolean } = {}): this {
    const base = resolve(directory);
    const extensions = options.extensions ?? ['.js', '.cjs', '.json'];
    for (const file of findCommandFiles(base, extensions, options.recurse ?? false)) {
      const loaded = require(file) as CommandModule | { default?: CommandModule };
      const commandModule = 'default' in loaded && loaded.default ? loaded.default : loaded;
      this.command(commandModule as CommandModule);
    }
    return this;
  }

  wrap(width: number | null = this.terminalWidth()): this {
    this.wrapWidth = width === null ? undefined : width;
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

  addHelpOpt(option: string | boolean = 'help', description = 'Show help'): this {
    return this.help(option, description);
  }

  showHidden(option: string | boolean = 'show-hidden', description = 'Show hidden options'): this {
    this.showHiddenOptions = true;
    if (option !== false) this.option(typeof option === 'string' ? option : 'show-hidden', { type: 'boolean', describe: description });
    return this;
  }

  addShowHiddenOpt(option: string | boolean = 'show-hidden', description = 'Show hidden options'): this {
    return this.showHidden(option, description);
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

  usageConfiguration(_config: Dictionary): this {
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

  epilogue(text: string): this {
    return this.epilog(text);
  }

  scriptName(name: string): this {
    this.script = name;
    return this;
  }

  exitProcess(enabled = true): this {
    this.processExit = enabled;
    return this;
  }

  exit(code = 0, error?: Error): void {
    if (error) throw error;
    process.exit(code);
  }

  locale(locale?: string): string | this {
    if (locale === undefined) return this.localeValue;
    this.localeValue = locale;
    return this;
  }

  terminalWidth(width?: number): number {
    if (width !== undefined) this.wrapWidth = width;
    return this.wrapWidth ?? process.stdout.columns ?? 80;
  }

  getAliases(): Dictionary<string[]> {
    const aliases: Dictionary<string[]> = {};
    for (const definition of this.definitions.values()) aliases[definition.key] = [...definition.aliases];
    return aliases;
  }

  getCompletion(args: string[], done: (completions: string[]) => void): void {
    const argv = this.parseSync(args);
    const current = args.at(-1) ?? '';
    if (this.completionFunction) {
      const result = this.completionFunction(current, argv);
      if (result && typeof (result as Promise<string[]>).then === 'function') {
        void (result as Promise<string[]>).then((completions) => done(completions));
      } else {
        done(result as string[]);
      }
      return;
    }
    const completions = [
      ...this.commands.flatMap((command) => command.names),
      ...[...this.definitions.values()].flatMap((definition) => optionNames(definition))
    ];
    done(unique(completions));
  }

  getDemandedCommands(): Dictionary<unknown> {
    return { min: this.demandedCommandMin, max: this.demandedCommandMax };
  }

  getDemandedOptions(): string[] {
    return [...this.definitions.values()].filter((definition) => definition.demandOption).map((definition) => definition.key);
  }

  getDeprecatedOptions(): Dictionary<string | boolean> {
    const deprecated: Dictionary<string | boolean> = {};
    for (const definition of this.definitions.values()) {
      if (definition.deprecated) deprecated[definition.key] = definition.deprecated;
    }
    return deprecated;
  }

  getDetectLocale(): boolean {
    return this.detectLocaleEnabled;
  }

  getExitProcess(): boolean {
    return this.processExit;
  }

  getGroups(): Dictionary<string[]> {
    return Object.fromEntries(this.groupMap);
  }

  getInternalMethods(): Dictionary<unknown> {
    return {
      getCommandInstance: () => this.commands,
      getContext: () => ({}),
      getUsageInstance: () => this.getHelp(),
      runCommand: (command: string) => this.parse([command]),
      setHasOutput: () => undefined
    };
  }

  getOptions(): Dictionary<unknown> {
    return {
      alias: this.getAliases(),
      array: keysOfType(this.definitions, 'array'),
      boolean: keysOfType(this.definitions, 'boolean'),
      count: keysOfType(this.definitions, 'count'),
      default: Object.fromEntries([...this.definitions.values()].filter((definition) => definition.default !== undefined).map((definition) => [definition.key, definition.default])),
      number: keysOfType(this.definitions, 'number'),
      string: keysOfType(this.definitions, 'string')
    };
  }

  getStrict(): boolean {
    return this.strictMode;
  }

  getStrictCommands(): boolean {
    return this.strictCommandMode;
  }

  getStrictOptions(): boolean {
    return this.strictOptionMode;
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

    const visible = [...this.definitions.values()].filter((definition) => this.showHiddenOptions || !definition.hidden);
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

  showCompletionScript(output: (message: string) => void = console.log): void {
    output(`# ${this.script} completion\n${this.script} ${this.completionCommand}`);
  }

  showHelpOnFail(enabled = true, message?: string): this {
    this.showHelpOnFailEnabled = enabled;
    this.showHelpOnFailMessage = message;
    return this;
  }

  showVersion(output: (message: string) => void = console.log): void {
    output(`${this.versionValue ?? '0.0.0'}\n`);
  }

  skipValidation(keys: string | string[] = []): this {
    for (const key of asArray(keys)) this.skippedValidation.add(key);
    return this;
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

  async parseAsync(args?: string | string[]): Promise<Arguments> {
    const argv = this.parse(args);
    await this.lastHandlerResult;
    return argv;
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
      if (command.handler) this.lastHandlerResult = command.handler(state.argv);
      return { ...state, command };
    }

    return this.parseWithoutCommand(args);
  }

  private parseWithoutCommand(args: string[]): ParseState {
    const expandedArgs = expandNargs(args, this.definitions);
    const knownOptions = this.toParseArgsOptions();
    const optionConfig = this.strictOptionMode ? knownOptions : discoverUnknownOptions(expandedArgs, knownOptions);
    let parsed;
    try {
      parsed = parseArgs({
        args: expandedArgs,
        options: optionConfig,
        allowPositionals: true,
        strict: this.strictOptionMode,
        tokens: true,
        allowNegative: this.parserConfig['boolean-negation'] !== false
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
      setArgvValue(argv, definition.key, value, this.parserConfig);
      for (const alias of definition.aliases) setArgvValue(argv, alias, value, this.parserConfig);
    }

    for (const [key, value] of Object.entries(values)) {
      if (consumed.has(key) || isImplicitAliasOfKnownOption(key, this.definitions)) continue;
      setArgvValue(argv, key, coerceUnknownValue(value), this.parserConfig);
    }

    argv._ = shouldParsePositionalNumbers(this.parserConfig) ? parsed.positionals.map(toPositionalValue) : parsed.positionals;
    const dashDash = collectDashDash(expandedArgs);
    if (dashDash && this.parserConfig['populate--'] === true) {
      argv['--'] = dashDash;
      argv._ = argv._.slice(0, Math.max(0, argv._.length - dashDash.length));
    }

    this.applyConfigSources(argv);
    this.applyEnv(argv);
    this.runMiddlewareSync(argv, this.middlewareBeforeValidation);
    this.validateCommands(argv);
    this.validateRequiredArgs(argv);
    this.validateConflicts(argv);
    this.validateImplications(argv);

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

    this.runMiddlewareSync(argv, this.middlewareAfterValidation);

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
    child.conflictsMap = new Map([...this.conflictsMap].map(([key, value]) => [key, [...value]]));
    child.implications = new Map([...this.implications].map(([key, value]) => [key, [...value]]));
    child.demandedCommandMin = this.demandedCommandMin;
    child.demandedCommandMax = this.demandedCommandMax;
    child.demandedCommandMinMessage = this.demandedCommandMinMessage;
    child.demandedCommandMaxMessage = this.demandedCommandMaxMessage;
    child.groupMap = new Map([...this.groupMap].map(([key, value]) => [key, [...value]]));
    child.skippedValidation = new Set(this.skippedValidation);
    child.configObjects = this.configObjects.map((config) => structuredClone(config));
    child.configDefinitions = this.configDefinitions.map((config) => ({ ...config }));
    child.envPrefix = this.envPrefix;
    child.pkgConfEntries = this.pkgConfEntries.map((entry) => ({ ...entry }));
    child.middlewareBeforeValidation = [...this.middlewareBeforeValidation];
    child.middlewareAfterValidation = [...this.middlewareAfterValidation];
    child.completionFunction = this.completionFunction;
    child.usageMessage = this.usageMessage;
    child.epilogMessage = this.epilogMessage;
    child.failCallback = this.failCallback;
    child.processExit = this.processExit;
    child.strictMode = this.strictMode;
    child.strictOptionMode = this.strictOptionMode;
    child.strictCommandMode = this.strictCommandMode;
    child.showHiddenOptions = this.showHiddenOptions;
    child.detectLocaleEnabled = this.detectLocaleEnabled;
    child.localeValue = this.localeValue;
    child.showHelpOnFailEnabled = this.showHelpOnFailEnabled;
    child.showHelpOnFailMessage = this.showHelpOnFailMessage;
    child.completionCommand = this.completionCommand;
    child.wrapWidth = this.wrapWidth;
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
        if (definition.type === 'array' || definition.type === 'count' || definition.nargs !== undefined) options[name].multiple = true;
        if (name.length === 1) options[name].short = name;
      }
    }

    return options;
  }

  private applyConfigSources(argv: Arguments): void {
    for (const entry of this.pkgConfEntries) {
      const packageJson = findPackageJson(entry.cwd);
      if (!packageJson) continue;
      const config = readJson(packageJson) as Dictionary;
      const value = config[entry.key];
      if (isDictionary(value)) mergeDefaults(argv, value, this.definitions);
    }

    for (const config of this.configObjects) mergeDefaults(argv, config, this.definitions);

    for (const definition of this.configDefinitions) {
      const configValue = argv[definition.key];
      if (typeof configValue !== 'string') continue;
      const configPath = resolve(configValue);
      const config = definition.parse ? definition.parse(configPath) : readJson(configPath);
      mergeDefaults(argv, config, this.definitions);
    }
  }

  private applyEnv(argv: Arguments): void {
    if (this.envPrefix === undefined) return;
    const prefix = this.envPrefix ? `${this.envPrefix.replace(/_$/u, '')}_` : '';
    for (const [name, rawValue] of Object.entries(process.env)) {
      if (rawValue === undefined || !name.startsWith(prefix)) continue;
      const key = envNameToKey(name.slice(prefix.length));
      if (!key) continue;
      const definition = this.definitions.get(key) ?? findDefinitionByAlias(key, this.definitions);
      const value = parseEnvValue(rawValue, definition);
      setDefaultArgvValue(argv, definition?.key ?? key, value, definition);
    }
  }

  private runMiddlewareSync(argv: Arguments, middleware: MiddlewareFunction[]): void {
    for (const fn of middleware) {
      const result = fn(argv);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        this.lastHandlerResult = Promise.resolve(this.lastHandlerResult).then(() => result as Promise<void | Dictionary>).then((resolved) => {
          if (isDictionary(resolved)) Object.assign(argv, resolved);
        });
        continue;
      }
      if (isDictionary(result)) Object.assign(argv, result);
    }
  }

  private validateCommands(argv: Arguments): void {
    if (this.skippedValidation.has('$0')) return;
    const commandCount = argv._.filter((value) => this.commands.some((command) => command.names.includes(String(value)))).length;
    if (this.demandedCommandMin !== undefined && commandCount < this.demandedCommandMin) {
      throw new McargsError(this.demandedCommandMinMessage ?? `Not enough non-option arguments: got ${commandCount}, need at least ${this.demandedCommandMin}`, 'ERR_MCARGS_MISSING_COMMAND');
    }
    if (this.demandedCommandMax !== undefined && commandCount > this.demandedCommandMax) {
      throw new McargsError(this.demandedCommandMaxMessage ?? `Too many non-option arguments: got ${commandCount}, maximum of ${this.demandedCommandMax}`, 'ERR_MCARGS_TOO_MANY_COMMANDS');
    }
    if (this.strictCommandMode && this.commands.length > 0 && argv._.length > 0) {
      const commandName = String(argv._[0]);
      if (!this.commands.some((command) => command.names.includes(commandName))) {
        throw new McargsError(`Unknown command: ${commandName}`, 'ERR_MCARGS_UNKNOWN_COMMAND');
      }
    }
  }

  private validateRequiredArgs(argv: Arguments): void {
    for (const definition of this.definitions.values()) {
      if (this.skippedValidation.has(definition.key)) continue;
      const value = argv[definition.key];
      if (definition.requiresArg && (value === true || value === undefined || value === '')) {
        throw new McargsError(`Argument ${definition.key} requires an argument`, 'ERR_MCARGS_REQUIRES_ARG');
      }
      if (definition.nargs !== undefined && value !== undefined && (Array.isArray(value) ? value.length : 1) < definition.nargs) {
        throw new McargsError(`Argument ${definition.key} expects ${definition.nargs} values`, 'ERR_MCARGS_NARGS');
      }
    }
  }

  private validateConflicts(argv: Arguments): void {
    for (const [key, conflictsWith] of this.conflictsMap) {
      if (argv[key] === undefined || this.skippedValidation.has(key)) continue;
      for (const other of conflictsWith) {
        if (argv[other] !== undefined) throw new McargsError(`Arguments ${key} and ${other} are mutually exclusive`, 'ERR_MCARGS_CONFLICTS');
      }
    }
  }

  private validateImplications(argv: Arguments): void {
    for (const [key, implied] of this.implications) {
      if (argv[key] === undefined || this.skippedValidation.has(key)) continue;
      for (const other of implied) {
        if (argv[other] === undefined) throw new McargsError(`Argument ${key} implies ${other}`, 'ERR_MCARGS_IMPLIES');
      }
    }
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

function keysOfType(definitions: Map<string, OptionDefinition>, type: PrimitiveOptionType): string[] {
  return [...definitions.values()].filter((definition) => definition.type === type).map((definition) => definition.key);
}

function discoverUnknownOptions(
  args: string[],
  known: Record<string, { type: 'string' | 'boolean'; multiple?: boolean; short?: string }>
): Record<string, { type: 'string' | 'boolean'; multiple?: boolean; short?: string }> {
  const options = structuredClone(known);
  const counts = countUnknownOptions(args, known);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === '--') break;
    if (!arg.startsWith('-') || arg === '-') continue;

    if (arg.startsWith('--no-')) {
      const name = arg.slice(5);
      if (!options[name]) options[name] = withMultiple({ type: 'boolean' }, counts.get(name));
      continue;
    }

    if (arg.startsWith('--')) {
      const [rawName, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
      const name = rawName!;
      if (!name || options[name]) continue;
      const next = args[index + 1];
      options[name] = withMultiple({ type: inlineValue !== undefined || (next !== undefined && !next.startsWith('-')) ? 'string' : 'boolean' }, counts.get(name));
      continue;
    }

    const shorts = arg.slice(1).split('');
    for (const shortName of shorts) {
      const existing = Object.values(options).some((option) => option.short === shortName) || options[shortName];
      if (existing) continue;
      const next = args[index + 1];
      options[shortName] = withMultiple({ type: shorts.length === 1 && next !== undefined && !next.startsWith('-') ? 'string' : 'boolean', short: shortName }, counts.get(shortName));
    }
  }
  return options;
}

function countUnknownOptions(args: string[], known: Record<string, { type: 'string' | 'boolean'; multiple?: boolean; short?: string }>): Map<string, number> {
  const counts = new Map<string, number>();
  const knownShorts = new Set(Object.values(known).map((option) => option.short).filter(Boolean));
  for (const arg of args) {
    if (arg === '--') break;
    if (arg.startsWith('--no-')) {
      const name = arg.slice(5);
      if (!known[name]) counts.set(name, (counts.get(name) ?? 0) + 1);
    } else if (arg.startsWith('--')) {
      const name = arg.slice(2).split('=', 1)[0]!;
      if (!known[name]) counts.set(name, (counts.get(name) ?? 0) + 1);
    } else if (arg.startsWith('-') && arg !== '-') {
      for (const shortName of arg.slice(1)) {
        if (!known[shortName] && !knownShorts.has(shortName)) counts.set(shortName, (counts.get(shortName) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function withMultiple<T extends { multiple?: boolean }>(option: T, count = 0): T {
  if (count > 1) option.multiple = true;
  return option;
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

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function shouldParsePositionalNumbers(config: Record<string, unknown>): boolean {
  return config['parse-positional-numbers'] !== false;
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

function setArgvValue(argv: Arguments, key: string, value: unknown, config: Record<string, unknown> = {}): void {
  if (config['dot-notation'] !== false && key.includes('.')) {
    setDottedValue(argv, key, value);
  } else {
    argv[key] = value;
  }
  const camel = camelCase(key);
  if (config['camel-case-expansion'] !== false && camel !== key) argv[camel] = value;
}

function setDefaultArgvValue(argv: Arguments, key: string, value: unknown, definition?: OptionDefinition): void {
  if (argv[key] !== undefined && argv[key] !== definition?.default) return;
  const coerced = definition ? coerceValue(definition.key, value, definition) : coerceUnknownValue(value);
  setArgvValue(argv, key, coerced);
  for (const alias of definition?.aliases ?? []) setArgvValue(argv, alias, coerced);
}

function setDottedValue(argv: Arguments, key: string, value: unknown): void {
  const parts = key.split('.').filter(Boolean);
  if (parts.length < 2) return;
  let cursor: Record<string, unknown> = argv;
  for (const part of parts.slice(0, -1)) {
    if (typeof cursor[part] !== 'object' || cursor[part] === null || Array.isArray(cursor[part])) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts.at(-1)!] = value;
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

  if (definition.normalize) {
    if (Array.isArray(coerced)) coerced = coerced.map((entry) => typeof entry === 'string' ? normalizePath(entry) : entry);
    else if (typeof coerced === 'string') coerced = normalizePath(coerced);
  }

  if (definition.coerce) coerced = definition.coerce(coerced);

  if (definition.choices && !definition.choices.includes(coerced)) {
    throw new McargsError(`Invalid value for ${key}: ${String(coerced)}. Expected one of: ${definition.choices.join(', ')}`, 'ERR_MCARGS_CHOICES');
  }

  return coerced;
}

function coerceUnknownValue(value: unknown): unknown {
  if (typeof value === 'string') return toPositionalValue(value);
  if (Array.isArray(value)) return value.map(coerceUnknownValue);
  return value;
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
    const parsed = parseArgs({ args, options, strict, allowPositionals: true, tokens: true, allowNegative: true });
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

function expandNargs(args: string[], definitions: Map<string, OptionDefinition>): string[] {
  const byName = new Map<string, OptionDefinition>();
  for (const definition of definitions.values()) {
    for (const name of [definition.key, ...definition.aliases, ...implicitAliases(definition.key)]) byName.set(name, definition);
  }

  const result: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    result.push(arg);
    if (arg === '--') {
      result.push(...args.slice(index + 1));
      break;
    }

    const optionName = optionNameFromArg(arg);
    if (!optionName) continue;
    const definition = byName.get(optionName);
    if (!definition?.nargs || arg.includes('=')) continue;

    let consumed = 0;
    while (consumed < definition.nargs && index + 1 < args.length) {
      const next = args[index + 1]!;
      if (next.startsWith('-')) break;
      result.push(next);
      index += 1;
      consumed += 1;
      if (consumed < definition.nargs) result.push(arg);
    }
  }
  return result;
}

function optionNameFromArg(arg: string): string | undefined {
  if (arg.startsWith('--no-')) return arg.slice(5);
  if (arg.startsWith('--')) return arg.slice(2).split('=', 1)[0];
  if (arg.startsWith('-') && arg.length === 2) return arg.slice(1);
  return undefined;
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

function isDictionary(value: unknown): value is Dictionary {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(path: string): Dictionary {
  return JSON.parse(readFileSync(path, 'utf8')) as Dictionary;
}

function mergeDefaults(argv: Arguments, config: Dictionary, definitions: Map<string, OptionDefinition>, prefix = ''): void {
  for (const [key, value] of Object.entries(config)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (isDictionary(value)) {
      mergeDefaults(argv, value, definitions, fullKey);
      if (argv[key] === undefined && !prefix) setArgvValue(argv, key, value);
      continue;
    }
    const definition = definitions.get(fullKey) ?? definitions.get(key) ?? findDefinitionByAlias(fullKey, definitions) ?? findDefinitionByAlias(key, definitions);
    setDefaultArgvValue(argv, definition?.key ?? fullKey, value, definition);
  }
}

function findDefinitionByAlias(key: string, definitions: Map<string, OptionDefinition>): OptionDefinition | undefined {
  for (const definition of definitions.values()) {
    if (definition.aliases.includes(key) || implicitAliases(definition.key).includes(key)) return definition;
  }
  return undefined;
}

function envNameToKey(name: string): string {
  return name.toLowerCase().replace(/__/gu, '.').replace(/_/gu, '-');
}

function parseEnvValue(value: string, definition?: OptionDefinition): unknown {
  if (definition?.type === 'boolean') return !/^(?:false|0|no)$/iu.test(value);
  if (definition?.type === 'number' || /^-?\d+(?:\.\d+)?$/u.test(value)) return Number(value);
  if (definition?.type === 'array') return value.split(',').map((entry) => entry.trim());
  if (/^(?:true|false)$/iu.test(value)) return value.toLowerCase() === 'true';
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function findPackageJson(cwd: string): string | undefined {
  let current = resolve(cwd);
  while (true) {
    const candidate = join(current, 'package.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function findCommandFiles(directory: string, extensions: string[], recurse: boolean): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (recurse) files.push(...findCommandFiles(path, extensions, recurse));
      continue;
    }
    if (entry.isFile() && extensions.includes(extname(entry.name))) files.push(path);
  }
  return files;
}

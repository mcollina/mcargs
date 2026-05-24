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

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { McargsError } from './error.ts';
import { buildHelp } from './help.ts';
import { applyConfigSources as applyConfigSourcesForState, applyEnv as applyEnvForState, applyResultConfiguration as applyResultConfigurationForState, runMiddlewareSync as runMiddlewareSyncForState, validateCommands as validateCommandsForState, validateConflicts as validateConflictsForState, validateImplications as validateImplicationsForState, validateRequiredArgs as validateRequiredArgsForState } from './runtime.ts';
import type { Arguments, Argv, Builder, CheckFunction, CommandDefinition, CommandModule, ConfigParseFunction, Dictionary, FailCallback, Handler, MiddlewareFunction, OptionDefinition, Options, OptionsMap, ParseCallback, ParseState, PositionalDefinition, PositionalOptions, PrimitiveOptionType } from './types.ts';
import { asArray, camelCase, cloneDefinition, coerceUnknownValue, coerceValue, collectDashDash, discoverUnknownOptions, emptyArguments, expandMultiValueOptions, fillMissingStringOptionValues, findCommandFiles, firstPositionalToken, genericParseType, hasExplicitType, implicitAliases, inferType, isDictionary, isImplicitAliasOfKnownOption, keysOfType, makeCommand, normalizeCommandModule, normalizeOptions, preprocessShortOptions, removeAt, setArgvValue, setUnknownArgvValue, shouldParsePositionalNumbers, splitArgs, toPositionalValue, typeFromDefault, unique } from './utils.ts';

const noopMethods = new Set([
  'recommendCommands',
  'updateLocale',
  'updateStrings'
]);

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
  private commandDirLoads: Array<Promise<void>> = [];
  private commandDirLoadError?: Error;
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
      type,
      generic: previous?.generic ?? !hasExplicitType(incoming)
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
      definition.generic = false;
    } else {
      for (const [name, defaultValue] of Object.entries(key)) {
        const definition = this.ensureOption(name);
        definition.default = defaultValue;
        definition.type = typeFromDefault(defaultValue) ?? definition.type;
        definition.generic = false;
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

    const definition = this.ensureOption(key);
    definition.choices = values ?? [];
    definition.generic = false;
    if (definition.type === 'boolean' && !definition.boolean) definition.type = 'string';
    return this;
  }

  coerce(key: string | Dictionary<(value: unknown) => unknown>, fn?: (value: unknown) => unknown): this {
    if (typeof key === 'object') {
      for (const [name, coerceFn] of Object.entries(key)) this.coerce(name, coerceFn);
      return this;
    }

    if (fn) {
      const definition = this.ensureOption(key);
      definition.coerce = fn;
      definition.generic = false;
      if (definition.type === 'boolean' && !definition.boolean) definition.type = 'string';
    }
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
    definition.generic = false;
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
    const extensions = options.extensions ?? ['.js', '.cjs', '.mjs'];
    const loads = findCommandFiles(base, extensions, options.recurse ?? false).map(async (file) => {
      const loaded = await import(pathToFileURL(file).href) as CommandModule | { default?: CommandModule };
      const commandModule = normalizeCommandModule(loaded);
      this.command(commandModule);
    });
    this.commandDirLoads.push(...loads.map((load) => load.catch((error: unknown) => {
      this.commandDirLoadError = error instanceof Error ? error : new Error(String(error));
      throw this.commandDirLoadError;
    })));
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
    return buildHelp({
      script: this.script,
      usageMessage: this.usageMessage,
      commands: this.commands,
      definitions: this.definitions,
      showHiddenOptions: this.showHiddenOptions,
      examples: this.examples,
      epilogMessage: this.epilogMessage
    });
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
      this.assertCommandDirsLoaded();
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
    await this.loadCommandDirs();
    const argv = this.parse(args);
    await this.lastHandlerResult;
    return argv;
  }

  parseSync(args?: string | string[]): Arguments {
    return this.parse(args);
  }

  private async loadCommandDirs(): Promise<void> {
    if (this.commandDirLoads.length === 0) return;
    const loads = this.commandDirLoads;
    this.commandDirLoads = [];
    await Promise.all(loads);
    if (this.commandDirLoadError) throw this.commandDirLoadError;
  }

  private assertCommandDirsLoaded(): void {
    if (this.commandDirLoadError) throw this.commandDirLoadError;
    if (this.commandDirLoads.length > 0) {
      throw new McargsError('commandDir() loads CommonJS and ESM modules asynchronously; use parseAsync() after commandDir().', 'ERR_MCARGS_COMMAND_DIR_ASYNC');
    }
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
    const expandedArgs = preprocessShortOptions(expandMultiValueOptions(args, this.definitions, this.parserConfig), this.parserConfig);
    const knownOptions = this.toParseArgsOptions(expandedArgs);
    const parseInput = fillMissingStringOptionValues(expandedArgs, this.definitions, knownOptions);
    const optionConfig = this.strictOptionMode ? knownOptions : discoverUnknownOptions(parseInput, knownOptions, this.parserConfig);
    let parsed;
    try {
      parsed = parseArgs({
        args: parseInput,
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

      value = coerceValue(definition.key, value, definition, this.parserConfig);
      setArgvValue(argv, definition.key, value, this.parserConfig);
      for (const alias of definition.aliases) setArgvValue(argv, alias, value, this.parserConfig);
    }

    for (const [key, value] of Object.entries(values)) {
      if (consumed.has(key) || isImplicitAliasOfKnownOption(key, this.definitions)) continue;
      setUnknownArgvValue(argv, key, coerceUnknownValue(value, this.parserConfig), this.parserConfig);
    }

    argv._ = shouldParsePositionalNumbers(this.parserConfig) ? parsed.positionals.map(toPositionalValue) : parsed.positionals;
    const dashDash = collectDashDash(parseInput);
    if (dashDash && this.parserConfig['populate--'] === true) {
      argv['--'] = dashDash.map((value) => coerceUnknownValue(value, this.parserConfig)) as string[];
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
    this.applyResultConfiguration(argv);

    return { argv, output };
  }

  private findCommand(args: string[]): { command: CommandDefinition; index: number } | undefined {
    const first = firstPositionalToken(args, this.toParseArgsOptions(args), this.strictMode);
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
    const definition: OptionDefinition = { key, aliases: [], type: 'boolean', generic: true };
    this.definitions.set(key, definition);
    return definition;
  }

  private setType(keys: string | string[], type: PrimitiveOptionType): this {
    for (const key of asArray(keys)) {
      const definition = this.ensureOption(key);
      definition.type = type;
      definition.generic = false;
      if (type === 'array') definition.array = true;
      if (type === 'boolean') definition.boolean = true;
      if (type === 'count') definition.count = true;
      if (type === 'number') definition.number = true;
      if (type === 'string') definition.string = true;
    }
    return this;
  }

  private toParseArgsOptions(args: string[] = []): Record<string, { type: 'string' | 'boolean'; multiple?: boolean; short?: string }> {
    const options: Record<string, { type: 'string' | 'boolean'; multiple?: boolean; short?: string }> = {};

    for (const definition of this.definitions.values()) {
      for (const name of [definition.key, ...definition.aliases, ...implicitAliases(definition.key)]) {
        if (options[name]) continue;
        const parseType = definition.generic ? genericParseType(args, definition) : definition.type === 'boolean' || definition.type === 'count' ? 'boolean' : 'string';
        options[name] = { type: parseType };
        if (definition.type === 'array' || definition.type === 'count' || definition.nargs !== undefined) options[name].multiple = true;
        if (name.length === 1) options[name].short = name;
      }
    }

    return options;
  }

  private applyConfigSources(argv: Arguments): void {
    applyConfigSourcesForState(argv, this.pkgConfEntries, this.configObjects, this.configDefinitions, this.definitions);
  }

  private applyEnv(argv: Arguments): void {
    applyEnvForState(argv, this.envPrefix, this.definitions);
  }

  private runMiddlewareSync(argv: Arguments, middleware: MiddlewareFunction[]): void {
    this.lastHandlerResult = runMiddlewareSyncForState(argv, middleware, this.lastHandlerResult);
  }

  private applyResultConfiguration(argv: Arguments): void {
    applyResultConfigurationForState(argv, this.parserConfig, this.definitions);
  }

  private validateCommands(argv: Arguments): void {
    validateCommandsForState({
      argv,
      skippedValidation: this.skippedValidation,
      commands: this.commands,
      demandedCommandMin: this.demandedCommandMin,
      demandedCommandMax: this.demandedCommandMax,
      demandedCommandMinMessage: this.demandedCommandMinMessage,
      demandedCommandMaxMessage: this.demandedCommandMaxMessage,
      strictCommandMode: this.strictCommandMode
    });
  }

  private validateRequiredArgs(argv: Arguments): void {
    validateRequiredArgsForState(argv, this.skippedValidation, this.definitions);
  }

  private validateConflicts(argv: Arguments): void {
    validateConflictsForState(argv, this.skippedValidation, this.conflictsMap);
  }

  private validateImplications(argv: Arguments): void {
    validateImplicationsForState(argv, this.skippedValidation, this.implications);
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


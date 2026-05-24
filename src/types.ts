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

export interface OptionDefinition extends Options {
  key: string;
  aliases: string[];
  type: PrimitiveOptionType;
  generic: boolean;
}

export interface PositionalDefinition extends PositionalOptions {
  key: string;
  type: PrimitiveOptionType;
}

export interface CommandDefinition {
  names: string[];
  display: string;
  description?: string | false;
  positionals: PositionalDefinition[];
  builder?: Builder;
  handler?: Handler;
}

export interface ParseState {
  argv: Arguments;
  command?: CommandDefinition;
  output: string;
}


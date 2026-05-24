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

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, normalize as normalizePath, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { McargsError } from './error.ts';
import type { Arguments, Builder, CommandDefinition, CommandModule, Dictionary, OptionDefinition, Options, PositionalDefinition, PrimitiveOptionType } from './types.ts';

export function normalizeOptions(options: Options | PrimitiveOptionType): Options {
  if (typeof options === 'string') return { type: options };
  return { ...options };
}

export function keysOfType(definitions: Map<string, OptionDefinition>, type: PrimitiveOptionType): string[] {
  return [...definitions.values()].filter((definition) => definition.type === type).map((definition) => definition.key);
}

export function discoverUnknownOptions(
  args: string[],
  known: Record<string, { type: 'string' | 'boolean'; multiple?: boolean; short?: string }>,
  config: Record<string, unknown> = {}
): Record<string, { type: 'string' | 'boolean'; multiple?: boolean; short?: string }> {
  const options = structuredClone(known);
  const counts = config['duplicate-arguments-array'] === false ? new Map<string, number>() : countUnknownOptions(args, known);

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
      options[name] = withMultiple({ type: inlineValue !== undefined || (next !== undefined && (!next.startsWith('-') || isNegativeNumber(next))) ? 'string' : 'boolean' }, counts.get(name));
      continue;
    }

    const shorts = arg.slice(1).split('');
    for (const shortName of shorts) {
      const existing = Object.values(options).some((option) => option.short === shortName) || options[shortName];
      if (existing) continue;
      const next = args[index + 1];
      options[shortName] = withMultiple({ type: shorts.length === 1 && next !== undefined && (!next.startsWith('-') || isNegativeNumber(next)) ? 'string' : 'boolean', short: shortName }, counts.get(shortName));
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

function isNegativeNumber(value: string): boolean {
  return /^-\d+(?:\.\d+)?$/u.test(value);
}

export function hasExplicitType(options: Options): boolean {
  return Boolean(options.type || options.array || options.count || options.number || options.string || options.boolean);
}

export function genericParseType(args: string[], definition: OptionDefinition): 'string' | 'boolean' {
  return hasOptionValue(args, definition) ? 'string' : 'boolean';
}

export function inferType(options: Options, fallback: PrimitiveOptionType = 'boolean'): PrimitiveOptionType {
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

export function typeFromDefault(value: unknown): PrimitiveOptionType | undefined {
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'boolean') return 'boolean';
  return undefined;
}

export function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function shouldParsePositionalNumbers(config: Record<string, unknown>): boolean {
  return config['parse-positional-numbers'] !== false;
}

function hasOptionValue(args: string[], definition: OptionDefinition): boolean {
  const names = new Set([definition.key, ...definition.aliases, ...implicitAliases(definition.key)]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === '--') return false;
    const name = optionNameFromArg(arg);
    if (!name || !names.has(name)) continue;
    if (arg.includes('=')) return true;
    const next = args[index + 1];
    return next !== undefined && (!next.startsWith('-') || isNegativeNumber(next));
  }
  return false;
}

export function splitArgs(args: string | string[]): string[] {
  if (Array.isArray(args)) return [...args];
  return args.trim() === '' ? [] : args.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((arg) => arg.replace(/^(['"])(.*)\1$/, '$2')) ?? [];
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function emptyArguments(script: string): Arguments {
  return { _: [], $0: script };
}

export function camelCase(value: string): string {
  return value.replace(/-([a-zA-Z0-9])/g, (_match, char: string) => char.toUpperCase());
}

export function implicitAliases(key: string): string[] {
  const camel = camelCase(key);
  return camel === key ? [] : [camel];
}

export function isImplicitAliasOfKnownOption(key: string, definitions: Map<string, OptionDefinition>): boolean {
  for (const definition of definitions.values()) {
    if (implicitAliases(definition.key).includes(key)) return true;
  }
  return false;
}

export function setArgvValue(argv: Arguments, key: string, value: unknown, config: Record<string, unknown> = {}): void {
  if (config['dot-notation'] !== false && key.includes('.')) {
    setDottedValue(argv, key, value);
  } else {
    argv[key] = value;
  }
  const camel = camelCase(key);
  if (config['camel-case-expansion'] !== false && camel !== key) argv[camel] = value;
}

export function setDefaultArgvValue(argv: Arguments, key: string, value: unknown, definition?: OptionDefinition): void {
  if (argv[key] !== undefined && argv[key] !== definition?.default) return;
  const coerced = definition ? coerceValue(definition.key, value, definition) : coerceUnknownValue(value);
  setArgvValue(argv, key, coerced);
  for (const alias of definition?.aliases ?? []) setArgvValue(argv, alias, coerced);
}

export function setUnknownArgvValue(argv: Arguments, key: string, value: unknown, config: Record<string, unknown>): void {
  const related = relatedKeys(argv, key, config);
  const existingKey = related.find((candidate) => argv[candidate] !== undefined);
  const finalValue = existingKey ? mergeArgValues(argv[existingKey], value) : value;
  setArgvValue(argv, key, finalValue, config);
  for (const candidate of related) {
    if (candidate !== key && argv[candidate] !== undefined) setArgvValue(argv, candidate, finalValue, config);
  }
}

function relatedKeys(argv: Arguments, key: string, config: Record<string, unknown>): string[] {
  if (config['camel-case-expansion'] === false) return [key];
  const camel = camelCase(key);
  const keys = new Set([key, camel]);
  for (const existing of Object.keys(argv)) {
    if (camelCase(existing) === camel) keys.add(existing);
  }
  return [...keys];
}

function mergeArgValues(existing: unknown, value: unknown): unknown[] {
  return [...(Array.isArray(existing) ? existing : [existing]), ...(Array.isArray(value) ? value : [value])];
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

export function coerceValue(key: string, value: unknown, definition: Options & { type: PrimitiveOptionType; generic?: boolean }, config: Record<string, unknown> = {}): unknown {
  let coerced = value;

  if (definition.generic && typeof coerced === 'string') {
    coerced = coerceUnknownValue(coerced, config);
  }

  if (definition.type === 'array') {
    coerced = Array.isArray(coerced) ? coerced : [coerced];
    if (!definition.string) coerced = coerced.map((entry) => coerceUnknownValue(entry, config));
  } else if (definition.nargs !== undefined && Array.isArray(coerced) && !definition.string) {
    coerced = coerced.map((entry) => coerceUnknownValue(entry, config));
  } else if (definition.type === 'count') {
    coerced = Array.isArray(coerced) ? coerced.length : coerced === undefined ? 0 : 1;
  } else if (definition.type === 'number') {
    if (Array.isArray(coerced)) {
      coerced = coerced.map((entry) => toNumber(key, entry));
    } else if (coerced === '') {
      coerced = undefined;
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

export function coerceUnknownValue(value: unknown, config: Record<string, unknown> = {}): unknown {
  if (typeof value === 'string') return config['parse-numbers'] === false ? value : toUnknownNumberOrString(value);
  if (Array.isArray(value)) return value.map((entry) => coerceUnknownValue(entry, config));
  return value;
}

function toUnknownNumberOrString(value: string): string | number {
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) return Number(value);
  return value;
}

function toNumber(key: string, value: unknown): number {
  const number = Number(value);
  if (Number.isNaN(number)) throw new McargsError(`Invalid number for ${key}: ${String(value)}`, 'ERR_MCARGS_NUMBER');
  return number;
}

export function toPositionalValue(value: string): string | number {
  return /^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : value;
}

export function firstPositionalToken(
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

export function removeAt(args: string[], index: number): string[] {
  const result = [...args];
  result.splice(index, 1);
  return result;
}

export function collectDashDash(args: string[]): string[] | undefined {
  const index = args.indexOf('--');
  if (index === -1) return undefined;
  return args.slice(index + 1);
}

export function fillMissingStringOptionValues(
  args: string[],
  definitions: Map<string, OptionDefinition>,
  options: Record<string, { type: 'string' | 'boolean'; multiple?: boolean; short?: string }>
): string[] {
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
    const name = optionNameFromArg(arg);
    if (!name || arg.includes('=')) continue;
    const option = options[name] ?? Object.values(options).find((candidate) => candidate.short === name);
    if (option?.type !== 'string') continue;
    const next = args[index + 1];
    if (next === undefined || (next.startsWith('-') && !isNegativeNumber(next))) {
      const definition = byName.get(name);
      result.push(definition?.default === undefined ? '' : String(definition.default));
    }
  }
  return result;
}

export function preprocessShortOptions(args: string[], config: Record<string, unknown> = {}): string[] {
  const result: string[] = [];
  for (const arg of args) {
    if (config['short-option-groups'] === false && /^-[^-].{1,}/u.test(arg) && !/^-[^-=][=-]/u.test(arg)) {
      result.push(`--${arg.slice(1)}`);
      continue;
    }

    const equals = arg.match(/^-([^-=])=(.*)$/u);
    if (equals) {
      result.push(`-${equals[1]}`, equals[2] ?? '');
      continue;
    }

    const attachedNumber = arg.match(/^-([^-=])(-?(?:0|[1-9]\d*)(?:\.\d+)?)$/u);
    if (attachedNumber) {
      result.push(`-${attachedNumber[1]}`, attachedNumber[2] ?? '');
      continue;
    }

    result.push(arg);
  }
  return result;
}

export function expandMultiValueOptions(args: string[], definitions: Map<string, OptionDefinition>, config: Record<string, unknown> = {}): string[] {
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
    if (!definition || arg.includes('=')) continue;

    const limit = definition.nargs ?? (definition.type === 'array' && config['greedy-arrays'] !== false ? Number.POSITIVE_INFINITY : 0);
    let consumed = 0;
    while (consumed < limit && index + 1 < args.length) {
      const next = args[index + 1]!;
      if (next.startsWith('-') && !(definition.nargs !== undefined && config['nargs-eats-options'] === true)) break;
      result.push(next);
      index += 1;
      consumed += 1;
      if (consumed < limit && index + 1 < args.length && !args[index + 1]!.startsWith('-')) result.push(arg);
    }
  }
  return result;
}

export function optionNameFromArg(arg: string): string | undefined {
  if (arg.startsWith('--no-')) return arg.slice(5);
  if (arg.startsWith('--')) return arg.slice(2).split('=', 1)[0];
  if (arg.startsWith('-') && arg.length === 2) return arg.slice(1);
  return undefined;
}

export function makeCommand(command: string | string[], description?: string | false, builder?: Builder, handler?: Handler): CommandDefinition {
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

export function cloneDefinition(definition: OptionDefinition): OptionDefinition {
  return {
    ...definition,
    aliases: [...definition.aliases],
    choices: definition.choices ? [...definition.choices] : undefined
  };
}

export function optionNames(definition: OptionDefinition): string[] {
  return [definition.key, ...definition.aliases]
    .map((name) => (name.length === 1 ? `-${name}` : `--${name}`));
}

export function normalizeCommandModule(loaded: CommandModule | { default?: CommandModule }): CommandModule {
  if ('default' in loaded && loaded.default) return loaded.default;
  return loaded as CommandModule;
}

export function isDictionary(value: unknown): value is Dictionary {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readJson(path: string): Dictionary {
  return JSON.parse(readFileSync(path, 'utf8')) as Dictionary;
}

export function mergeDefaults(argv: Arguments, config: Dictionary, definitions: Map<string, OptionDefinition>, prefix = ''): void {
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

export function findDefinitionByAlias(key: string, definitions: Map<string, OptionDefinition>): OptionDefinition | undefined {
  for (const definition of definitions.values()) {
    if (definition.aliases.includes(key) || implicitAliases(definition.key).includes(key)) return definition;
  }
  return undefined;
}

export function envNameToKey(name: string): string {
  return name.toLowerCase().replace(/__/gu, '.').replace(/_/gu, '-');
}

export function parseEnvValue(value: string, definition?: OptionDefinition): unknown {
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

export function findPackageJson(cwd: string): string | undefined {
  let current = resolve(cwd);
  while (true) {
    const candidate = join(current, 'package.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export function findCommandFiles(directory: string, extensions: string[], recurse: boolean): string[] {
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

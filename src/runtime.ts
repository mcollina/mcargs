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

import { McargsError } from './error.ts';
import type { Arguments, CommandDefinition, ConfigParseFunction, Dictionary, MiddlewareFunction, OptionDefinition } from './types.ts';
import { camelCase, findDefinitionByAlias, findPackageJson, isDictionary, mergeDefaults, parseEnvValue, readJson, setDefaultArgvValue, envNameToKey } from './utils.ts';

export function applyConfigSources(
  argv: Arguments,
  pkgConfEntries: Array<{ key: string; cwd: string }>,
  configObjects: Dictionary[],
  configDefinitions: Array<{ key: string; parse?: ConfigParseFunction }>,
  definitions: Map<string, OptionDefinition>
): void {
  for (const entry of pkgConfEntries) {
    const packageJson = findPackageJson(entry.cwd);
    if (!packageJson) continue;
    const config = readJson(packageJson) as Dictionary;
    const value = config[entry.key];
    if (isDictionary(value)) mergeDefaults(argv, value, definitions);
  }

  for (const config of configObjects) mergeDefaults(argv, config, definitions);

  for (const definition of configDefinitions) {
    const configValue = argv[definition.key];
    if (typeof configValue !== 'string') continue;
    const configPath = resolve(configValue);
    const config = definition.parse ? definition.parse(configPath) : readJson(configPath);
    mergeDefaults(argv, config, definitions);
  }
}

export function applyEnv(argv: Arguments, envPrefix: string | undefined, definitions: Map<string, OptionDefinition>): void {
  if (envPrefix === undefined) return;
  const prefix = envPrefix ? `${envPrefix.replace(/_$/u, '')}_` : '';
  for (const [name, rawValue] of Object.entries(process.env)) {
    if (rawValue === undefined || !name.startsWith(prefix)) continue;
    const key = envNameToKey(name.slice(prefix.length));
    if (!key) continue;
    const definition = definitions.get(key) ?? findDefinitionByAlias(key, definitions);
    const value = parseEnvValue(rawValue, definition);
    setDefaultArgvValue(argv, definition?.key ?? key, value, definition);
  }
}

export function runMiddlewareSync(
  argv: Arguments,
  middleware: MiddlewareFunction[],
  lastHandlerResult?: void | Promise<void>
): void | Promise<void> {
  let resultChain = lastHandlerResult;
  for (const fn of middleware) {
    const result = fn(argv);
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      resultChain = Promise.resolve(resultChain).then(() => result as Promise<void | Dictionary>).then((resolved) => {
        if (isDictionary(resolved)) Object.assign(argv, resolved);
      });
      continue;
    }
    if (isDictionary(result)) Object.assign(argv, result);
  }
  return resultChain;
}

export function applyResultConfiguration(argv: Arguments, parserConfig: Record<string, unknown>, definitions: Map<string, OptionDefinition>): void {
  if (parserConfig['set-placeholder-key'] === true) {
    for (const definition of definitions.values()) {
      if (argv[definition.key] === undefined) argv[definition.key] = undefined;
    }
  }

  if (parserConfig['strip-aliased'] === true) {
    for (const definition of definitions.values()) {
      for (const alias of definition.aliases) {
        delete argv[alias];
        delete argv[camelCase(alias)];
      }
    }
  }

  if (parserConfig['strip-dashed'] === true && parserConfig['camel-case-expansion'] !== false) {
    for (const key of Object.keys(argv)) {
      if (key.includes('-')) delete argv[key];
    }
  }
}

export function validateCommands(options: {
  argv: Arguments;
  skippedValidation: Set<string>;
  commands: CommandDefinition[];
  demandedCommandMin?: number;
  demandedCommandMax?: number;
  demandedCommandMinMessage?: string;
  demandedCommandMaxMessage?: string;
  strictCommandMode: boolean;
}): void {
  const { argv, skippedValidation, commands, demandedCommandMin, demandedCommandMax, demandedCommandMinMessage, demandedCommandMaxMessage, strictCommandMode } = options;
  if (skippedValidation.has('$0')) return;
  const commandCount = argv._.filter((value) => commands.some((command) => command.names.includes(String(value)))).length;
  if (demandedCommandMin !== undefined && commandCount < demandedCommandMin) {
    throw new McargsError(demandedCommandMinMessage ?? `Not enough non-option arguments: got ${commandCount}, need at least ${demandedCommandMin}`, 'ERR_MCARGS_MISSING_COMMAND');
  }
  if (demandedCommandMax !== undefined && commandCount > demandedCommandMax) {
    throw new McargsError(demandedCommandMaxMessage ?? `Too many non-option arguments: got ${commandCount}, maximum of ${demandedCommandMax}`, 'ERR_MCARGS_TOO_MANY_COMMANDS');
  }
  if (strictCommandMode && commands.length > 0 && argv._.length > 0) {
    const commandName = String(argv._[0]);
    if (!commands.some((command) => command.names.includes(commandName))) {
      throw new McargsError(`Unknown command: ${commandName}`, 'ERR_MCARGS_UNKNOWN_COMMAND');
    }
  }
}

export function validateRequiredArgs(argv: Arguments, skippedValidation: Set<string>, definitions: Map<string, OptionDefinition>): void {
  for (const definition of definitions.values()) {
    if (skippedValidation.has(definition.key)) continue;
    const value = argv[definition.key];
    if (definition.requiresArg && (value === true || value === undefined || value === '')) {
      throw new McargsError(`Argument ${definition.key} requires an argument`, 'ERR_MCARGS_REQUIRES_ARG');
    }
    if (definition.nargs !== undefined && value !== undefined && (Array.isArray(value) ? value.length : 1) < definition.nargs) {
      throw new McargsError(`Argument ${definition.key} expects ${definition.nargs} values`, 'ERR_MCARGS_NARGS');
    }
  }
}

export function validateConflicts(argv: Arguments, skippedValidation: Set<string>, conflictsMap: Map<string, string[]>): void {
  for (const [key, conflictsWith] of conflictsMap) {
    if (argv[key] === undefined || skippedValidation.has(key)) continue;
    for (const other of conflictsWith) {
      if (argv[other] !== undefined) throw new McargsError(`Arguments ${key} and ${other} are mutually exclusive`, 'ERR_MCARGS_CONFLICTS');
    }
  }
}

export function validateImplications(argv: Arguments, skippedValidation: Set<string>, implications: Map<string, string[]>): void {
  for (const [key, implied] of implications) {
    if (argv[key] === undefined || skippedValidation.has(key)) continue;
    for (const other of implied) {
      if (argv[other] === undefined) throw new McargsError(`Argument ${key} implies ${other}`, 'ERR_MCARGS_IMPLIES');
    }
  }
}

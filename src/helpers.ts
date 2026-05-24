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

import yargs, { type Arguments, type OptionsMap } from './index.ts';

export { hideBin } from './index.ts';

export function Parser(args: string | string[], options: { configuration?: Record<string, unknown>; [key: string]: unknown } = {}): Arguments {
  const parser = yargs(args);
  if (options.configuration) parser.parserConfiguration(options.configuration);
  if (options.opts && typeof options.opts === 'object') parser.options(options.opts as OptionsMap);
  return parser.parseSync();
}

Parser.detailed = function detailed(args: string | string[], options: { configuration?: Record<string, unknown>; [key: string]: unknown } = {}) {
  const argv = Parser(args, options);
  return {
    argv,
    aliases: {},
    error: null,
    newAliases: {},
    configuration: options.configuration ?? {},
    defaulted: {}
  };
};

export function applyExtends<T>(config: T): T {
  return config;
}

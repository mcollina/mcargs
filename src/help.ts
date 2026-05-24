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

import type { CommandDefinition, OptionDefinition } from './types.ts';
import { optionNames } from './utils.ts';

export function buildHelp(options: {
  script: string;
  usageMessage?: string;
  commands: CommandDefinition[];
  definitions: Map<string, OptionDefinition>;
  showHiddenOptions: boolean;
  examples: Array<{ command: string; description: string }>;
  epilogMessage?: string;
}): string {
  const lines: string[] = [];
  lines.push(options.usageMessage ?? `Usage: ${options.script} [options]`);

  if (options.commands.length > 0) {
    lines.push('', 'Commands:');
    for (const command of options.commands) {
      if (command.description === false) continue;
      lines.push(`  ${command.display.padEnd(24)} ${command.description ?? ''}`.trimEnd());
    }
  }

  const visible = [...options.definitions.values()].filter((definition) => options.showHiddenOptions || !definition.hidden);
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

  if (options.examples.length > 0) {
    lines.push('', 'Examples:');
    for (const example of options.examples) {
      lines.push(`  ${example.command.padEnd(24)} ${example.description}`.trimEnd());
    }
  }

  if (options.epilogMessage) {
    lines.push('', options.epilogMessage);
  }

  return `${lines.join('\n')}\n`;
}

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

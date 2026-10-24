// AI-generated (Claude)
// Tool arguments, declared once. A tool lists its parameters as `Param`s;
// `inputSchema` turns them into the JSON Schema `tools/list` publishes and
// `parseArgs` checks a call against the same list, so the two cannot drift.
//
// Only what the tools here need: flat objects of strings, numbers, booleans
// and lists of string choices.

/** A bad argument. Reported to the client as a tool error it can correct. */
export class ToolArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolArgumentError';
  }
}

export type Param =
  | { type: 'string'; description: string; choices?: readonly string[] }
  | { type: 'number' | 'integer'; description: string; minimum?: number; maximum?: number }
  | { type: 'boolean'; description: string }
  | { type: 'choices'; description: string; choices: readonly string[] };

export type Params = Record<string, Param>;

type ValueOf<P extends Param> = P extends { type: 'string'; choices: readonly (infer C)[] }
  ? C
  : P extends { type: 'string' }
    ? string
    : P extends { type: 'boolean' }
      ? boolean
      : P extends { type: 'choices'; choices: readonly (infer C)[] }
        ? C[]
        : number;

/** A parsed call: every parameter optional, typed by its declaration. */
export type Args<P extends Params> = { [K in keyof P]?: ValueOf<P[K]> };

function schemaOf(param: Param): Record<string, unknown> {
  switch (param.type) {
    case 'choices':
      return {
        type: 'array',
        items: { type: 'string', enum: param.choices },
        description: param.description,
      };
    case 'string':
      return param.choices
        ? { type: 'string', enum: param.choices, description: param.description }
        : { type: 'string', description: param.description };
    default:
      return { ...param };
  }
}

export function inputSchema(params: Params): Record<string, unknown> {
  return {
    type: 'object',
    properties: Object.fromEntries(Object.entries(params).map(([key, p]) => [key, schemaOf(p)])),
    additionalProperties: false,
  };
}

function check(key: string, param: Param, value: unknown): unknown {
  switch (param.type) {
    case 'string':
      if (typeof value !== 'string') {
        throw new ToolArgumentError(`"${key}" must be a string`);
      }
      if (param.choices && !param.choices.includes(value)) {
        throw new ToolArgumentError(`"${key}" must be one of: ${param.choices.join(', ')}`);
      }
      return value;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new ToolArgumentError(`"${key}" must be true or false`);
      }
      return value;
    case 'choices':
      if (!Array.isArray(value) || value.some((v) => !param.choices.includes(v as string))) {
        throw new ToolArgumentError(`"${key}" must be a list of: ${param.choices.join(', ')}`);
      }
      return value;
    default: {
      const integer = param.type === 'integer';
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        (integer && !Number.isInteger(value))
      ) {
        throw new ToolArgumentError(`"${key}" must be ${integer ? 'an integer' : 'a number'}`);
      }
      if (
        (param.minimum !== undefined && value < param.minimum) ||
        (param.maximum !== undefined && value > param.maximum)
      ) {
        throw new ToolArgumentError(
          `"${key}" must be between ${param.minimum ?? '-inf'} and ${param.maximum ?? 'inf'}`,
        );
      }
      return value;
    }
  }
}

/** Checks a call's arguments against `params`. null counts as absent. */
export function parseArgs<P extends Params>(params: P, args: Record<string, unknown>): Args<P> {
  const parsed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    const param = params[key];
    if (!param) {
      throw new ToolArgumentError(`Unknown argument "${key}"`);
    }
    if (value !== null && value !== undefined) {
      parsed[key] = check(key, param, value);
    }
  }
  return parsed as Args<P>;
}

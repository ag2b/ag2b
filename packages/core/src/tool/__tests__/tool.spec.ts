import { it as baseIt } from 'vitest';
import z from 'zod/v4';

import { Tool } from '../tool';

const it = baseIt
  .extend(
    'parameters',
    z.object({
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    })
  )
  .extend('tool', ({ parameters }) => {
    return new Tool({
      name: 'sum',
      description: 'Sum two numbers',
      parameters,
      handler: ({ a, b }) => a + b,
    });
  })
  .extend('tool_promise', ({ parameters }) => {
    return new Tool({
      name: 'sum',
      description: 'Sum two numbers',
      parameters,
      handler: ({ a, b }) => Promise.resolve(a + b),
    });
  });

describe('Tool', () => {
  it('should return tool name', ({ tool }) => {
    expect(tool.name).toEqual('sum');
  });

  it('should return tool description', ({ tool }) => {
    expect(tool.description).toEqual('Sum two numbers');
  });

  it('should return tool parameters', ({ tool, parameters }) => {
    expect(tool.parameters).toEqual(parameters);
  });

  it('should return tool handler', ({ tool }) => {
    expect(typeof tool.handler).toBe('function');
  });

  it('should return tool schema', ({ tool }) => {
    expect(tool.schema).toEqual({
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' },
      },
      required: ['a', 'b'],
      additionalProperties: false,
    });
  });

  it('should expose only allowlisted top-level schema keys', ({ tool }) => {
    const allowed = [
      'type',
      'properties',
      'required',
      'additionalProperties',
      'description',
      '$defs',
    ];
    const keys = Object.keys(tool.schema);
    for (const key of keys) {
      expect(allowed).toContain(key);
    }
  });

  describe('Tool::execute', () => {
    it('should execute sync handler', ({ tool }) => {
      const result = tool.execute({ a: 1, b: 1 });
      expect(result).toBe(2);
    });

    it('should execute async handler', async ({ tool_promise }) => {
      const result = await tool_promise.execute({ a: 1, b: 1 });
      expect(result).toBe(2);
    });

    it('should execute handler with no parameters', () => {
      const tool = new Tool({
        name: 'noop',
        description: 'No params',
        parameters: z.object({}),
        handler: () => 'done',
      });

      expect(tool.execute({})).toBe('done');
    });

    it('should throw on invalid arguments', ({ tool, tool_promise }) => {
      // @ts-expect-error invalid args passed for the test
      expect(() => tool.execute({ a: 1 })).toThrow();
      // @ts-expect-error invalid args passed for the test
      expect(() => tool_promise.execute({ a: 1 })).toThrow();
    });

    it('rethrows non-ZodError thrown from schema.parse() unchanged', () => {
      const parameters = z.object({ a: z.number() });
      const tool = new Tool({
        name: 'sum',
        description: 'Sum',
        parameters,
        handler: ({ a }) => a,
      });

      const oddError = new TypeError('parse blew up in a weird way');
      parameters.parse = () => {
        throw oddError;
      };

      expect(() => tool.execute({ a: 1 })).toThrow(oddError);
    });
  });

  describe('Tool::isEnabled', () => {
    const parameters = z.object({ a: z.number() });
    const config = {
      name: 'thing',
      description: 'd',
      parameters,
      handler: ({ a }: { a: number }) => a,
    } as const;

    it('returns true when no `enabled` was provided', () => {
      const tool = new Tool(config);
      expect(tool.isEnabled()).toBe(true);
    });

    it('returns true when `enabled` returns true', () => {
      const tool = new Tool({ ...config, enabled: () => true });
      expect(tool.isEnabled()).toBe(true);
    });

    it('returns false when `enabled` returns false', () => {
      const tool = new Tool({ ...config, enabled: () => false });
      expect(tool.isEnabled()).toBe(false);
    });

    it('returns false when `enabled` throws', () => {
      const tool = new Tool({
        ...config,
        enabled: () => {
          throw new Error('boom');
        },
      });
      expect(tool.isEnabled()).toBe(false);
    });

    it('re-evaluates `enabled` on each call (does not cache)', () => {
      let flag = true;
      const tool = new Tool({ ...config, enabled: () => flag });

      expect(tool.isEnabled()).toBe(true);
      flag = false;
      expect(tool.isEnabled()).toBe(false);
      flag = true;
      expect(tool.isEnabled()).toBe(true);
    });

    it('exposes the original `enabled` function via the getter', () => {
      const fn = () => true;
      const tool = new Tool({ ...config, enabled: fn });
      expect(tool.enabled).toBe(fn);
    });
  });

  describe('Tool::name', () => {
    const parameters = z.object({ a: z.number(), b: z.number() });

    it.each(['has space', 'has.dot', 'has/slash', 'has@at', '', '   '])(
      'should throw on invalid name: "%s"',
      (name) => {
        expect(
          () =>
            new Tool({
              name,
              description: 'test',
              parameters,
              handler: ({ a, b }) => a + b,
            })
        ).toThrow('Invalid tool name');
      }
    );

    it.each(['valid', 'valid_name', 'valid-name', 'validName123', 'a', 'A_b-C'])(
      'should accept valid name: "%s"',
      (name) => {
        expect(
          () =>
            new Tool({
              name,
              description: 'test',
              parameters,
              handler: ({ a, b }) => a + b,
            })
        ).not.toThrow();
      }
    );
  });
});

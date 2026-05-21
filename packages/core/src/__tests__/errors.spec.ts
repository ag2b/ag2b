import z from 'zod/v4';

import {
  Ag2bDisabledToolError,
  Ag2bError,
  Ag2bMaxIterationsError,
  Ag2bProviderRequestError,
  Ag2bProviderResponseError,
  Ag2bToolValidationError,
  Ag2bUnknownToolError,
  serializeError,
} from '@/errors';

describe('Ag2bError', () => {
  it('extends Error', () => {
    const error = new Ag2bError('test');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(Ag2bError);
    expect(error.message).toBe('test');
  });

  it('reports name as "Ag2bError"', () => {
    expect(new Ag2bError('x').name).toBe('Ag2bError');
  });
});

describe('Ag2bProviderRequestError', () => {
  it('extends Ag2bError', () => {
    const error = new Ag2bProviderRequestError('request failed', 400, 'Bad request');

    expect(error).toBeInstanceOf(Ag2bError);
    expect(error).toBeInstanceOf(Ag2bProviderRequestError);
  });

  it('reports name as "Ag2bProviderRequestError"', () => {
    expect(new Ag2bProviderRequestError('x').name).toBe('Ag2bProviderRequestError');
  });

  it('stores status and body', () => {
    const error = new Ag2bProviderRequestError('request failed', 500, { detail: 'server error' });

    expect(error.message).toBe('request failed');
    expect(error.status).toBe(500);
    expect(error.body).toEqual({ detail: 'server error' });
  });

  it('handles undefined status and body', () => {
    const error = new Ag2bProviderRequestError('request failed');

    expect(error.status).toBeUndefined();
    expect(error.body).toBeUndefined();
  });
});

describe('Ag2bProviderResponseError', () => {
  it('extends Ag2bError', () => {
    const error = new Ag2bProviderResponseError('empty choices');

    expect(error).toBeInstanceOf(Ag2bError);
    expect(error).toBeInstanceOf(Ag2bProviderResponseError);
  });

  it('reports name as "Ag2bProviderResponseError"', () => {
    expect(new Ag2bProviderResponseError('x').name).toBe('Ag2bProviderResponseError');
  });

  it('preserves the message', () => {
    expect(new Ag2bProviderResponseError('parse failed').message).toBe('parse failed');
  });

  it('stores body', () => {
    const error = new Ag2bProviderResponseError('parse failed', '{not-json');

    expect(error.body).toBe('{not-json');
  });

  it('leaves body undefined when omitted', () => {
    expect(new Ag2bProviderResponseError('x').body).toBeUndefined();
  });
});

describe('Ag2bMaxIterationsError', () => {
  it('extends Ag2bError', () => {
    const error = new Ag2bMaxIterationsError(10);

    expect(error).toBeInstanceOf(Ag2bError);
    expect(error).toBeInstanceOf(Ag2bMaxIterationsError);
  });

  it('reports name as "Ag2bMaxIterationsError"', () => {
    expect(new Ag2bMaxIterationsError(1).name).toBe('Ag2bMaxIterationsError');
  });

  it('includes iteration count in message', () => {
    const error = new Ag2bMaxIterationsError(5);

    expect(error.message).toBe('Agent loop exceeded 5 iterations without a final response.');
  });
});

describe('Ag2bToolValidationError', () => {
  const issues: z.core.$ZodIssue[] = [
    {
      code: 'invalid_type',
      expected: 'number',
      path: ['a'],
      message: 'Expected number',
      input: undefined,
    },
  ];

  it('extends Ag2bError', () => {
    const error = new Ag2bToolValidationError('sum', issues);

    expect(error).toBeInstanceOf(Ag2bError);
    expect(error).toBeInstanceOf(Ag2bToolValidationError);
  });

  it('reports name as "Ag2bToolValidationError"', () => {
    expect(new Ag2bToolValidationError('sum', []).name).toBe('Ag2bToolValidationError');
  });

  it('stores tool name and issues', () => {
    const error = new Ag2bToolValidationError('sum', issues);

    expect(error.tool).toBe('sum');
    expect(error.issues).toBe(issues);
  });

  it('builds a message that includes the tool name', () => {
    const error = new Ag2bToolValidationError('sum', issues);

    expect(error.message).toBe('Invalid arguments passed for tool "sum"');
  });
});

describe('Ag2bUnknownToolError', () => {
  it('extends Ag2bError', () => {
    const error = new Ag2bUnknownToolError('ghost');

    expect(error).toBeInstanceOf(Ag2bError);
    expect(error).toBeInstanceOf(Ag2bUnknownToolError);
  });

  it('reports name as "Ag2bUnknownToolError"', () => {
    expect(new Ag2bUnknownToolError('x').name).toBe('Ag2bUnknownToolError');
  });

  it('builds a message that includes the tool name', () => {
    expect(new Ag2bUnknownToolError('ghost').message).toBe('Unknown tool "ghost"');
  });
});

describe('Ag2bDisabledToolError', () => {
  it('extends Ag2bError', () => {
    const error = new Ag2bDisabledToolError('addItem');

    expect(error).toBeInstanceOf(Ag2bError);
    expect(error).toBeInstanceOf(Ag2bDisabledToolError);
  });

  it('reports name as "Ag2bDisabledToolError"', () => {
    expect(new Ag2bDisabledToolError('x').name).toBe('Ag2bDisabledToolError');
  });

  it('builds a message that includes the tool name', () => {
    expect(new Ag2bDisabledToolError('addItem').message).toBe(
      'Tool "addItem" is currently unavailable'
    );
  });
});

describe('serializeError', () => {
  describe('Error handling', () => {
    it('extracts name and message from a plain Error', () => {
      expect(serializeError(new Error('boom'))).toEqual({
        name: 'Error',
        message: 'boom',
      });
    });

    it('extracts name and message from native Error subclasses', () => {
      expect(serializeError(new TypeError('bad type'))).toEqual({
        name: 'TypeError',
        message: 'bad type',
      });
      expect(serializeError(new RangeError('out of range'))).toEqual({
        name: 'RangeError',
        message: 'out of range',
      });
    });

    it('uses the overridden name from Ag2b errors', () => {
      const result = serializeError(new Ag2bError('x')) as { name: string };
      expect(result.name).toBe('Ag2bError');
    });

    it('preserves enumerable instance properties from Ag2bProviderRequestError', () => {
      const err = new Ag2bProviderRequestError('failed', 503, 'overloaded');

      expect(serializeError(err)).toEqual({
        name: 'Ag2bProviderRequestError',
        message: 'failed',
        status: 503,
        body: 'overloaded',
      });
    });

    it('preserves enumerable instance properties from Ag2bToolValidationError', () => {
      const issues: z.core.$ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['name'],
          message: 'Expected string',
          input: undefined,
        },
      ];
      const err = new Ag2bToolValidationError('greet', issues);

      expect(serializeError(err)).toEqual({
        name: 'Ag2bToolValidationError',
        message: 'Invalid arguments passed for tool "greet"',
        tool: 'greet',
        issues,
      });
    });

    it('survives JSON.stringify roundtrip for Error', () => {
      const err = new Error('oops');
      const json = JSON.stringify(serializeError(err));

      expect(JSON.parse(json)).toEqual({ name: 'Error', message: 'oops' });
    });

    it('survives JSON.stringify roundtrip for Ag2b errors with payloads', () => {
      const err = new Ag2bProviderRequestError('failed', 500, { detail: 'x' });
      const json = JSON.stringify(serializeError(err));

      expect(JSON.parse(json)).toEqual({
        name: 'Ag2bProviderRequestError',
        message: 'failed',
        status: 500,
        body: { detail: 'x' },
      });
    });
  });

  describe('non-Error pass-through', () => {
    it('passes strings through unchanged', () => {
      expect(serializeError('oops')).toBe('oops');
      expect(serializeError('')).toBe('');
    });

    it('passes numbers, booleans, null, undefined through unchanged', () => {
      expect(serializeError(42)).toBe(42);
      expect(serializeError(true)).toBe(true);
      expect(serializeError(false)).toBe(false);
      expect(serializeError(null)).toBeNull();
      expect(serializeError(undefined)).toBeUndefined();
    });

    it('passes plain objects through unchanged (same reference)', () => {
      const obj = { code: 'RATE_LIMITED', retry_after: 30 };

      expect(serializeError(obj)).toBe(obj);
    });

    it('passes arrays through unchanged', () => {
      const arr = [1, 2, 3];

      expect(serializeError(arr)).toBe(arr);
    });
  });
});

import { beforeAll, describe, expect, it } from 'bun:test';

let forceFont: typeof import('../screenshot-actions').forceFont;

beforeAll(async () => {
  (globalThis as Record<string, unknown>).Cypress = {
    Commands: { add: () => undefined }
  };
  ({ forceFont } = await import('../screenshot-actions'));
});

function createFakeDocument() {
  const appended: Array<{ type: string; children: Array<{ text: string }> }> =
    [];
  const doc = {
    createElement: () => ({
      type: '',
      children: [] as Array<{ text: string }>,
      appendChild(node: { text: string }) {
        this.children.push(node);
      }
    }),
    createTextNode: (text: string) => ({ text }),
    head: {
      appendChild: (node: {
        type: string;
        children: Array<{ text: string }>;
      }) => appended.push(node)
    }
  } as unknown as Document;
  return { doc, appended };
}

describe('forceFont', () => {
  it('injects the Arial override into the provided document head', () => {
    const { doc, appended } = createFakeDocument();

    const result = forceFont(doc);

    expect(result).not.toBe(false);
    expect(appended).toHaveLength(1);
    expect(appended[0]?.children[0]?.text).toEqual(
      '* { font-family: Arial !important; }'
    );
  });

  it('returns false when no document is provided', () => {
    expect(forceFont(undefined as unknown as Document)).toBe(false);
  });
});

// AI-generated (Claude)
// The planner notes, which the core writes as HTML (add_plan_to_notes in
// core/plannernotes.cpp).
//
// There is no web view in this app, and the notes are not arbitrary HTML: divs,
// line breaks, one table, bold and coloured spans. This turns that into blocks a
// native view can draw, and picks out the warnings so they can go where the diver
// looks first. The words stay the core's: nothing here decides what is a problem.
//
// A saved plan keeps these notes in the logbook, so the dive screen draws them too.

export type NoteSpan = { text: string; bold: boolean; danger: boolean };

export type NoteBlock =
  | { kind: 'line'; spans: NoteSpan[] }
  | { kind: 'table'; header: string[]; rows: string[][] };

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  mdash: '—',
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  Delta: 'Δ',
};

/** The arrows are outside what the system font draws on every version; so says the Qt model. */
const CODE_POINTS: Record<number, string> = { 10136: '↓', 10137: '→', 10138: '↑' };

export function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|\w+);/g, (whole, name: string) => {
    if (name.startsWith('#')) {
      const code = Number(name.slice(1));
      return CODE_POINTS[code] ?? String.fromCodePoint(code);
    }
    return ENTITIES[name] ?? whole;
  });
}

type Token = { tag: string; closing: boolean; attributes: string } | { text: string };

function tokens(html: string): Token[] {
  const out: Token[] = [];
  const pattern = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|[^<]+|</g;
  for (const match of html.matchAll(pattern)) {
    if (match[2]) {
      out.push({ tag: match[2].toLowerCase(), closing: match[1] === '/', attributes: match[3] });
    } else {
      out.push({ text: match[0] });
    }
  }
  return out;
}

/** Runs of whitespace are one space, as in a browser; a line keeps no space at its ends. */
function tidy(spans: NoteSpan[]): NoteSpan[] {
  const collapsed = spans.map((span) => ({ ...span, text: span.text.replace(/\s+/g, ' ') }));
  const out = collapsed.filter((span) => span.text !== '');
  if (out.length > 0) {
    out[0] = { ...out[0], text: out[0].text.trimStart() };
    const last = out.length - 1;
    out[last] = { ...out[last], text: out[last].text.trimEnd() };
  }
  return out.filter((span) => span.text !== '');
}

export function parsePlanNotes(html: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let line: NoteSpan[] = [];
  let bold = 0;
  let red: boolean[] = [];

  let table: { header: string[]; rows: string[][] } | null = null;
  let row: string[] | null = null;
  let cell: string | null = null;
  let inHead = false;

  const flushLine = () => {
    const spans = tidy(line);
    if (spans.length > 0) {
      blocks.push({ kind: 'line', spans });
    }
    line = [];
  };

  for (const token of tokens(html)) {
    if ('text' in token) {
      const text = decodeEntities(token.text);
      if (cell !== null) {
        cell += text;
      } else if (table === null) {
        // The core colours gas names red as well as warnings. Only a warning should
        // read as one, and a gas name is the bold run inside the span.
        line.push({ text, bold: bold > 0, danger: red.some(Boolean) && bold === 0 });
      }
      continue;
    }

    const { tag, closing, attributes } = token;
    switch (tag) {
      case 'br':
      case 'div':
      case 'p':
        if (table === null) {
          flushLine();
        }
        break;
      case 'b':
      case 'strong':
        bold = Math.max(0, bold + (closing ? -1 : 1));
        break;
      case 'span':
        if (closing) {
          red = red.slice(0, -1);
        } else {
          red = [...red, /color:\s*(red|indianred)/.test(attributes)];
        }
        break;
      case 'table':
        if (closing) {
          if (table !== null) {
            blocks.push({ kind: 'table', ...table });
          }
          table = null;
        } else {
          flushLine();
          table = { header: [], rows: [] };
        }
        break;
      case 'thead':
        inHead = !closing;
        break;
      case 'tr':
        if (closing) {
          if (table !== null && row !== null) {
            if (inHead) {
              table.header = row;
            } else {
              table.rows.push(row);
            }
          }
          row = null;
        } else {
          row = [];
        }
        break;
      case 'th':
      case 'td':
        if (closing) {
          row?.push((cell ?? '').replace(/\s+/g, ' ').trim());
          cell = null;
        } else {
          cell = '';
        }
        break;
      default:
        break;
    }
  }
  flushLine();
  return blocks;
}

/** Every line of the notes that starts a warning, without the word "Warning:". */
export function planNoteWarnings(html: string): string[] {
  const out: string[] = [];
  for (const block of parsePlanNotes(html)) {
    if (block.kind !== 'line') {
      continue;
    }
    const text = block.spans.map((span) => span.text).join('');
    const at = text.indexOf('Warning:');
    if (at >= 0) {
      const warning = text.slice(at + 'Warning:'.length).trim();
      if (warning !== '' && !out.includes(warning)) {
        out.push(warning);
      }
    }
  }
  return out;
}

/** The notes as plain text: what an accessibility label or a copy can carry. */
export function planNotesText(blocks: readonly NoteBlock[]): string {
  return blocks
    .map((block) =>
      block.kind === 'line'
        ? block.spans.map((span) => span.text).join('')
        : [block.header, ...block.rows].map((cells) => cells.join(' ').trim()).join('\n'),
    )
    .join('\n');
}

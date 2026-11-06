// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import { decodeEntities, parsePlanNotes, planNotesText, planNoteWarnings } from './plan-notes';

// Written by the core: add_plan_to_notes(), on a 30 m plan on air in too small a cylinder.
const NOTES = `<div>
<b>Subsurface (6.0.5798-local) dive plan</b> created on 11/06/26<br/>
Runtime: 43min, Stop times: + 2:12 /m + 1:41 /min<br/>
</div>
<table>
<thead>
<tr><th></th><th>depth</th><th style='padding-left: 10px;'>duration</th><th style='padding-left: 10px;'>runtime</th><th style='padding-left: 10px; float: left;'>gas</th></tr>
</thead>
<tbody style='float: left;'>
<tr><td style='padding-left: 10px; float: right;'>&#10136;</td><td style='padding-left: 10px; float: right;'> 30m</td><td style='padding-left: 10px; float: right;'>  2min</td><td style='padding-left: 10px; float: right;'>  2min</td><td style='padding-left: 10px; color: red; float: left;'><b>Air </b></td></tr>
<tr><td>-</td><td> 12m</td><td>  1min</td><td> 28min</td><td>&nbsp;</td></tr>
</tbody>
</table>
<br/>
<div>
CNS: 6%<br/>
</div>
<div>
Gas consumption (based on SAC 20|17L/min):<br/>
2480L/212bar of <span style='color: red;'><b>Air</b></span> (534L/44bar in planned ascent)<br/>
&nbsp;&mdash; <span style='color: red;'>Warning: </span> this is more gas than available in the specified cylinder (end pressure &lt;= 10bar)!<br/>
</div>
`;

describe('parsePlanNotes', () => {
  const blocks = parsePlanNotes(NOTES);

  it('turns divs and line breaks into lines, and keeps what is bold', () => {
    const first = blocks[0];
    expect(first.kind).toBe('line');
    if (first.kind === 'line') {
      expect(first.spans[0]).toEqual({
        text: 'Subsurface (6.0.5798-local) dive plan',
        bold: true,
        danger: false,
      });
      expect(first.spans[1].text).toBe(' created on 11/06/26');
    }
  });

  it('reads the table with its header and arrows, and trims the padding', () => {
    const table = blocks.find((block) => block.kind === 'table');
    if (table?.kind !== 'table') {
      throw new Error('no table');
    }
    expect(table.header).toEqual(['', 'depth', 'duration', 'runtime', 'gas']);
    expect(table.rows[0]).toEqual(['↓', '30m', '2min', '2min', 'Air']);
    expect(table.rows[1]).toEqual(['-', '12m', '1min', '28min', '']);
  });

  it('draws a warning in danger but not a gas name the core also made red', () => {
    const lines = blocks.flatMap((block) => (block.kind === 'line' ? block.spans : []));
    expect(lines.find((span) => span.text === 'Air')).toMatchObject({ bold: true, danger: false });
    expect(lines.find((span) => span.text.startsWith('Warning'))?.danger).toBe(true);
  });

  it('keeps no markup in the text', () => {
    expect(planNotesText(blocks)).not.toMatch(/[<>]\w|&\w+;/);
    expect(planNotesText(blocks)).toContain('Runtime: 43min');
  });
});

describe('planNoteWarnings', () => {
  it('finds a warning anywhere on a line, in the core\'s words', () => {
    expect(planNoteWarnings(NOTES)).toEqual([
      'this is more gas than available in the specified cylinder (end pressure <= 10bar)!',
    ]);
  });

  it('gives one line for a warning repeated at several waypoints', () => {
    const line = "<span style='color: red;'>Warning: </span> high pO₂ value<br/>\n";
    expect(planNoteWarnings(line + line)).toEqual(['high pO₂ value']);
  });

  it('finds nothing in clean notes', () => {
    expect(planNoteWarnings('<div>Runtime: 20min<br/></div>')).toEqual([]);
  });
});

describe('decodeEntities', () => {
  it('handles named and numeric ones, and leaves what it does not know', () => {
    expect(decodeEntities('&#916;N&#8322; &Delta; &lt;= &unknown;')).toBe('ΔN₂ Δ <= &unknown;');
  });
});

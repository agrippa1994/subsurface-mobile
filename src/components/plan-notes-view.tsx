// AI-generated (Claude)
// The core's plan notes, drawn natively. See src/models/plan-notes.ts for why they
// are parsed rather than shown in a web view. Used on the planner's notes screen and
// for a saved plan on the dive screen.
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parsePlanNotes, type NoteBlock } from '@/models/plan-notes';
import { t } from '@/i18n';

export function PlanNotesView({ notes }: { notes: string }) {
  const blocks = useMemo(() => parsePlanNotes(notes), [notes]);
  return (
    <View style={styles.container}>
      {blocks.map((block, index) =>
        block.kind === 'line' ? (
          <NoteLine key={index} block={block} />
        ) : (
          <NoteTable key={index} block={block} />
        ),
      )}
    </View>
  );
}

function NoteLine({ block }: { block: Extract<NoteBlock, { kind: 'line' }> }) {
  const theme = useTheme();
  return (
    <Text selectable style={[styles.line, { color: theme.text }]}>
      {block.spans.map((span, index) => (
        <Text
          key={index}
          style={[
            span.bold ? styles.bold : null,
            span.danger ? { color: theme.danger, fontWeight: '600' } : null,
          ]}
        >
          {span.text}
        </Text>
      ))}
    </Text>
  );
}

const CELL_WIDTHS = [22, 58, 62, 62, 110];

function NoteTable({ block }: { block: Extract<NoteBlock, { kind: 'table' }> }) {
  const theme = useTheme();
  const width = (index: number) => CELL_WIDTHS[index] ?? 80;
  return (
    // Sideways rather than wrapped: columns that wrap stop being columns, on a narrow
    // phone at a large text size.
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View accessible accessibilityLabel={tableLabel(block)}>
        <View style={styles.row}>
          {block.header.map((cell, index) => (
            <Text key={index} style={[styles.head, { color: theme.textSecondary, width: width(index) }]}>
              {cell}
            </Text>
          ))}
        </View>
        {block.rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((cell, index) => (
              <Text
                key={index}
                selectable
                style={[styles.cell, { color: theme.text, width: width(index) }]}
              >
                {cell}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/** Read row by row: an arrow says nothing to a screen reader, the words around it do. */
function tableLabel(block: Extract<NoteBlock, { kind: 'table' }>): string {
  const spoken: Record<string, string> = {
    '↓': t('charts.notes.down'),
    '↑': t('charts.notes.up'),
    '→': t('charts.notes.stay'),
    '-': t('charts.notes.stop'),
  };
  return block.rows
    .map((row) => row.map((cell, index) => (index === 0 ? (spoken[cell] ?? cell) : cell)).join(' ').trim())
    .join('. ');
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  line: {
    fontSize: 15,
    lineHeight: 21,
  },
  bold: {
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
  },
  head: {
    fontSize: 13,
    paddingVertical: 2,
  },
  cell: {
    fontSize: 15,
    paddingVertical: 2,
    fontVariant: ['tabular-nums'],
  },
});

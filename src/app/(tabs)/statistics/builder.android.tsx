// AI-generated (Claude)
// The chart builder, Android variant, in Compose: dropdown menus for every choice. The
// variables are many, so their menu has headings.
import { useRouter } from 'expo-router';

import { HeaderAction } from '@/components/header-action';
import { M3MenuRow, M3Screen, M3Section, M3SwitchRow } from '@/components/material/list';
import {
  useBuilder,
  type BuilderField,
  type VariableField,
} from '@/features/statistics/use-builder';
import { t } from '@/i18n';
import { variableLabel } from '@/models/stats-chart';

function VariableRow({ field }: { field: VariableField }) {
  return (
    <M3MenuRow<string | null>
      label={field.label}
      value={field.selected}
      shown={variableLabel(field.selected)}
      groups={[
        ...(field.noneLabel ? [{ options: [{ value: null, label: field.noneLabel }] }] : []),
        ...field.groups.map((group) => ({
          title: group.title,
          options: group.variables.map((variable) => ({
            value: variable.name,
            label: variableLabel(variable.name),
          })),
        })),
      ]}
      onChange={field.onChoose}
    />
  );
}

function ChoiceRow({ field }: { field: BuilderField }) {
  return (
    <M3MenuRow
      label={field.label}
      value={field.selected}
      options={field.choices.map((choice) => ({ value: choice.key, label: choice.label }))}
      onChange={field.onChoose}
    />
  );
}

export default function BuilderScreen() {
  const builder = useBuilder();
  const router = useRouter();
  return (
    <>
      <HeaderAction label={t('ui.done')} done onPress={() => router.back()} />
      <M3Screen>
        <M3Section title={t('ui.whatToShow')} footer={builder.description}>
          {builder.first ? <VariableRow field={builder.first} /> : null}
          {builder.fields.map((field) => (
            <ChoiceRow key={field.key} field={field} />
          ))}
          {builder.second ? <VariableRow field={builder.second} /> : null}
          {builder.measures.map((field) => (
            <ChoiceRow key={field.key} field={field} />
          ))}
        </M3Section>
        <M3Section
          title={t('ui.howToShowIt')}
          footer={t('ui.theChartCountsTheDivesThe')}>
          {builder.display.map((field) => (
            <ChoiceRow key={field.key} field={field} />
          ))}
          {builder.features.map((feature) => (
            <M3SwitchRow
              key={feature.key}
              label={feature.label}
              value={feature.on}
              onChange={(on) => builder.setFeature(feature.key, on)}
            />
          ))}
        </M3Section>
      </M3Screen>
    </>
  );
}

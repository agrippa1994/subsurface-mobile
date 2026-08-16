// AI-generated (Claude)
// The dive editor: the fields a diver fills in after the dive.
//
// Depth, duration and the samples come from the dive computer and are not
// editable here - the core treats them as recorded data. What is editable is
// what the diver knows: site, buddies, tags, gear, conditions, notes.
//
// The draft lives in this screen and is turned into the smallest possible
// `updateDive` patch on save (models/dive-edit.ts), so a field nobody touched
// is never written back.

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormButtonRow, FormField, FormSection, RatingField } from '@/components/form';
import { NameField } from '@/components/name-field';
import { StatusView } from '@/components/status-view';
import { SuggestField, SuggestionChips } from '@/components/suggest-field';
import { Spacing } from '@/constants/theme';
import { CylinderEditor } from '@/features/dives/cylinder-editor';
import { SitePicker } from '@/features/dives/site-picker';
import { useTheme } from '@/hooks/use-theme';
import { getDive, previewDive } from '../../../../../modules/ssrf-core/src';
import type { Dive, DivePatch } from '@/models';
import { formatSac } from '@/models';
import {
  buildCylinderPatches,
  cylinderDraftsFrom,
  validateCylinderDrafts,
  type CylinderDraft,
} from '@/models/cylinder-edit';
import {
  buildDivePatch,
  harvestCylinderDescriptions,
  harvestNames,
  harvestSuits,
  harvestTags,
  diveDraftFrom,
  isEmptyPatch,
  parseTagInput,
  type DiveDraft,
} from '@/models/dive-edit';
import { describeError, formatErrorLine } from '@/models/errors';
import { useLogStore } from '@/store/log-store';
import { useUnitSystem } from '@/store/settings-store';

export default function DiveEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const diveId = Number(id);
  const router = useRouter();
  const theme = useTheme();
  const unitSystem = useUnitSystem();

  const dives = useLogStore((state) => state.dives);
  const sites = useLogStore((state) => state.sites);
  const updateDive = useLogStore((state) => state.updateDive);
  const flush = useLogStore((state) => state.flush);

  // The dive is read from the module rather than the cached list: the list rows
  // carry no notes or suit, and the editor writes those too.
  const loaded = useMemo<{ dive: Dive } | { error: string }>(() => {
    try {
      return { dive: getDive(diveId) };
    } catch (error) {
      return { error: formatErrorLine(describeError(error)) };
    }
  }, [diveId]);

  const [draft, setDraft] = useState<DiveDraft | null>(() =>
    'dive' in loaded ? diveDraftFrom(loaded.dive) : null
  );
  const [tagText, setTagText] = useState(() =>
    'dive' in loaded ? loaded.dive.tags.join(', ') : ''
  );
  // Cylinders are their own draft: they are a list of rows rather than a set of
  // fields, and unlike the rest of the editor they carry the identity a row
  // needs to survive a re-render (`CylinderDraft.key`).
  const [cylinders, setCylinders] = useState<CylinderDraft[]>(() =>
    'dive' in loaded ? cylinderDraftsFrom(loaded.dive, unitSystem) : []
  );
  const [pickingSite, setPickingSite] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const names = useMemo(() => harvestNames(dives), [dives]);
  const knownTags = useMemo(() => harvestTags(dives), [dives]);
  const knownSuits = useMemo(() => harvestSuits(dives), [dives]);
  const knownCylinders = useMemo(() => harvestCylinderDescriptions(dives), [dives]);

  const cylinderErrors = useMemo(
    () => validateCylinderDrafts(cylinders, unitSystem),
    [cylinders, unitSystem]
  );
  const cylindersValid = Object.keys(cylinderErrors).length === 0;

  /**
   * The `cylinders` key of the patch, or null when nothing about them changed.
   * Built once here and reused for both the SAC preview and the save, so the
   * number on screen is computed from exactly what saving would write.
   */
  const cylinderPatches = useMemo(() => {
    if (!('dive' in loaded) || !cylindersValid) {
      return null;
    }
    return buildCylinderPatches(loaded.dive, cylinders, unitSystem);
  }, [cylinders, cylindersValid, loaded, unitSystem]);

  /**
   * SAC as the core would compute it once these cylinders are saved. It comes
   * from the module rather than from arithmetic here because it depends on gas
   * compressibility and the dive's mean depth (`calculate_sac` in
   * core/divelist.cpp) - a second implementation could disagree with the file.
   */
  const sac = useMemo(() => {
    if (!('dive' in loaded)) {
      return 0;
    }
    if (cylinderPatches === null) {
      return loaded.dive.sac;
    }
    try {
      return previewDive(loaded.dive.id, { cylinders: cylinderPatches }).sac;
    } catch {
      // A preview is a convenience; a failure here must not stop the editor.
      // Whatever is wrong will be reported when the save attempts it for real.
      return 0;
    }
  }, [cylinderPatches, loaded]);

  const patch = useCallback(
    (changes: Partial<DiveDraft>) =>
      setDraft((current) => (current === null ? current : { ...current, ...changes })),
    []
  );

  const onSave = useCallback(async () => {
    if (!('dive' in loaded) || draft === null) {
      return;
    }
    if (!cylindersValid) {
      setSaveError('Fix the cylinder fields marked in red before saving.');
      return;
    }
    try {
      const divePatch: DivePatch = buildDivePatch(loaded.dive, draft);
      if (cylinderPatches !== null) {
        divePatch.cylinders = cylinderPatches;
      }
      if (!isEmptyPatch(divePatch)) {
        await updateDive(loaded.dive.id, divePatch);
        // The editor is about to close, so the debounce window has to end here:
        // a force-quit from the screen behind must still find the edit on disk.
        await flush();
      }
      router.back();
    } catch (error) {
      setSaveError(formatErrorLine(describeError(error)));
    }
  }, [cylinderPatches, cylindersValid, draft, flush, loaded, router, updateDive]);

  if ('error' in loaded || draft === null) {
    return (
      <StatusView
        kind="error"
        title="Dive not found"
        description={'error' in loaded ? loaded.error : undefined}
        systemImage="questionmark.circle"
      />
    );
  }

  const siteName = sites.find((site) => site.uuid === draft.siteUuid)?.name;
  const tagSuggestions = knownTags.filter((tag) => !draft.tags.includes(tag)).slice(0, 6);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag">
      <Stack.Screen
        options={{
          title: 'Edit dive',
          headerRight: () => (
            <Pressable onPress={onSave} accessibilityRole="button" hitSlop={Spacing.two}>
              <Text style={[styles.headerAction, { color: theme.accent }]}>Save</Text>
            </Pressable>
          ),
        }}
      />

      {saveError ? <Text style={[styles.error, { color: theme.danger }]}>{saveError}</Text> : null}

      <FormSection title="Place">
        <FormButtonRow
          label="Dive site"
          value={draft.siteUuid === 0 ? 'None' : siteName || 'Unnamed site'}
          onPress={() => setPickingSite(true)}
        />
      </FormSection>

      <FormSection title="People" footer="Separate names with commas.">
        <NameField
          label="Buddy"
          value={draft.buddy}
          corpus={names}
          placeholder="Alice, Bob"
          onChange={(buddy) => patch({ buddy })}
        />
        <NameField
          label="Divemaster"
          value={draft.diveguide}
          corpus={names}
          onChange={(diveguide) => patch({ diveguide })}
        />
      </FormSection>

      <FormSection title="Conditions">
        <RatingField label="Rating" value={draft.rating} onChange={(rating) => patch({ rating })} />
        <RatingField
          label="Visibility"
          value={draft.visibility}
          onChange={(visibility) => patch({ visibility })}
        />
        <SuggestField
          label="Suit"
          value={draft.suit}
          corpus={knownSuits}
          placeholder="5mm wetsuit"
          onChange={(suit) => patch({ suit })}
        />
      </FormSection>

      <CylinderEditor
        drafts={cylinders}
        errors={cylinderErrors}
        descriptions={knownCylinders}
        unitSystem={unitSystem}
        onChange={setCylinders}
      />

      <FormSection
        title="Gas consumption"
        footer="Surface air consumption, computed from the cylinder sizes and the start and end pressures.">
        <View style={styles.sacRow}>
          <Text style={[styles.sacLabel, { color: theme.text }]}>SAC</Text>
          <Text style={[styles.sacValue, { color: theme.text }]}>
            {sac > 0 ? formatSac(sac, unitSystem) : 'Not enough data'}
          </Text>
        </View>
      </FormSection>

      <FormSection title="Tags">
        <FormField
          label="Tags"
          value={tagText}
          onChangeText={(text) => {
            setTagText(text);
            patch({ tags: parseTagInput(text) });
          }}
          placeholder="boat, deep, night"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <SuggestionChips
          suggestions={tagSuggestions}
          onSelect={(tag) => {
            const next = [...draft.tags, tag];
            setTagText(next.join(', '));
            patch({ tags: next });
          }}
        />
      </FormSection>

      <FormSection title="Notes">
        <FormField
          label="Notes"
          value={draft.notes}
          onChangeText={(notes) => patch({ notes })}
          multiline
        />
      </FormSection>

      <View style={styles.footerSpace} />

      <SitePicker
        visible={pickingSite}
        selectedUuid={draft.siteUuid}
        onSelect={(siteUuid) => {
          patch({ siteUuid });
          setPickingSite(false);
        }}
        onClose={() => setPickingSite(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  headerAction: {
    fontSize: 17,
    fontWeight: '600',
  },
  error: {
    fontSize: 15,
  },
  sacRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  sacLabel: {
    fontSize: 17,
  },
  sacValue: {
    fontSize: 17,
    fontWeight: '600',
  },
  footerSpace: {
    height: Spacing.six,
  },
});

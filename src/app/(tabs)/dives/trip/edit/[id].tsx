// AI-generated (Claude)
// The trip editor: location and notes, the two things a trip has of its own.
//
// The usual form: the draft is turned into the smallest patch on save, which is
// on disk before the editor closes.
import { useForm } from '@tanstack/react-form';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { fieldError, FormField, FormSection } from '@/components/form';
import { HeaderAction } from '@/components/header-action';
import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { flush } from '@/lib/logbook-persist';
import type { Trip } from '@/models';
import { describeError, formatErrorLine } from '@/models/errors';
import { buildTripPatch, tripDraftFrom } from '@/models/trips';
import { useTrips } from '@/queries/logbook';
import { useUpdateTrip } from '@/queries/logbook-mutations';

export default function TripEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const tripsQuery = useTrips();
  const trip = tripsQuery.data?.find((candidate) => candidate.id === tripId);

  if (tripsQuery.error) {
    return (
      <StatusView
        kind="error"
        title="The trip could not be opened"
        description={formatErrorLine(describeError(tripsQuery.error))}
        systemImage="exclamationmark.triangle"
      />
    );
  }
  if (tripsQuery.isPending) {
    return <StatusView kind="loading" title="Opening trip" />;
  }
  if (!trip) {
    return (
      <StatusView
        kind="empty"
        title="This trip is gone"
        description="A trip ends when its last dive leaves it."
        systemImage="suitcase"
      />
    );
  }
  // Keyed for the reason the dive editor is: a draft must not outlive its trip.
  return <TripEditForm key={trip.id} trip={trip} />;
}

function TripEditForm({ trip }: { trip: Trip }) {
  const router = useRouter();
  const theme = useTheme();
  const updateTrip = useUpdateTrip();
  const form = useForm({
    defaultValues: tripDraftFrom(trip),
    onSubmit: async ({ value }) => {
      const patch = buildTripPatch(trip, value);
      if (Object.keys(patch).length > 0) {
        await updateTrip.mutateAsync({ id: trip.id, patch });
        await flush();
      }
      router.back();
    },
  });

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled">
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            <Stack.Screen options={{ title: 'Edit trip' }} />
            <HeaderAction
              label="Save"
              done
              disabled={isSubmitting}
              onPress={() => void form.handleSubmit()}
            />
          </>
        )}
      </form.Subscribe>

      {updateTrip.error ? (
        <Text selectable style={[styles.error, { color: theme.danger }]}>
          {fieldError([formatErrorLine(describeError(updateTrip.error))])}
        </Text>
      ) : null}

      <FormSection footer="The trip's dives keep their own dive sites.">
        <form.Field name="location">
          {(field) => (
            <FormField
              label="Location"
              placeholder="Where the trip went"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              autoCapitalize="words"
              returnKeyType="done"
            />
          )}
        </form.Field>
      </FormSection>

      <FormSection>
        <form.Field name="notes">
          {(field) => (
            <FormField
              label="Notes"
              placeholder="Operator, boat, who came along"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              multiline
            />
          )}
        </form.Field>
      </FormSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  error: {
    fontSize: 15,
  },
});

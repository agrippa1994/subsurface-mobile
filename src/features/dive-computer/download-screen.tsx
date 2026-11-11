// AI-generated (Claude)
// Downloading from a dive computer: pick it, download, review, accept.
//
// Follows the legacy DownloadFromDiveComputer.qml. Plain React Native, like the
// other editors (src/components/form.tsx): it mixes pickers, a progress bar and a
// checklist, none of which a SwiftUI form hosts well.

import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { FormButtonRow, FormSection } from '@/components/form';
import { SymbolView } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { selectionChanged } from '@/lib/haptics';
import {
  adapterMessage,
  computerLabel,
  connectionLabel,
  downloadedDiveRows,
} from '@/models/dive-computer';
import { useUnits } from '@/queries/settings';

import { ChoicePicker, type Choice } from './choice-picker';
import { useDiveComputer, type DiveComputerScreen } from './use-dive-computer';
import { t } from '@/i18n';

type PickerKind = 'vendor' | 'product' | 'connection' | null;

export function DownloadScreen() {
  const router = useRouter();
  const onDone = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    }
  }, [router]);
  const screen = useDiveComputer(onDone);
  const reviewing = screen.outcome.kind === 'review';

  return (
    <>
      {/* Leaving would cancel: only the Cancel button does that, and says so. */}
      <Stack.Screen options={{ gestureEnabled: !screen.running, headerBackVisible: !screen.running }} />
      {reviewing ? <Review screen={screen} /> : <Setup screen={screen} />}
    </>
  );
}

function Setup({ screen }: { screen: DiveComputerScreen }) {
  const theme = useTheme();
  const [picker, setPicker] = useState<PickerKind>(null);
  const close = useCallback(() => setPicker(null), []);

  const vendorChoices = useMemo<Choice<string>[]>(
    () => screen.vendors.map(({ vendor }) => ({ key: vendor, label: vendor, value: vendor })),
    [screen.vendors],
  );
  const productChoices = useMemo<Choice<string>[]>(
    () => screen.products.map((product) => ({ key: product, label: product, value: product })),
    [screen.products],
  );
  const connectionChoices = useMemo(
    () =>
      screen.choices.map((device) => ({
        key: device.address,
        label: connectionLabel(device),
        detail: device.vendor ? `${device.vendor} ${device.product}` : device.address,
        value: device,
      })),
    [screen.choices],
  );

  const adapter = adapterMessage(screen.scan.adapter);
  const notice = screen.permissionDenied
    ? t('download.adapter.unauthorized')
    : adapter;
  const { outcome, status, running } = screen;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      {notice ? (
        <Text style={[styles.notice, { color: theme.danger }]}>{notice}</Text>
      ) : null}

      <FormSection
        title={t('ui.diveComputer')}
        footer={t('ui.switchOnBluetoothOnTheDive')}>
        <FormButtonRow
          label={t('ui.vendor')}
          value={screen.vendor || t('download.choose')}
          onPress={() => setPicker('vendor')}
        />
        <FormButtonRow
          label={t('ui.model')}
          value={screen.product || t('download.choose')}
          onPress={() => (screen.vendor === '' ? setPicker('vendor') : setPicker('product'))}
        />
        <FormButtonRow
          label={t('ui.connection')}
          value={screen.connection ? connectionLabel(screen.connection) : t('download.choose')}
          onPress={() => setPicker('connection')}
        />
      </FormSection>

      {screen.remembered.length > 0 ? (
        <FormSection title={t('ui.previouslyUsed')}>
          {screen.remembered.map((computer) => (
            <FormButtonRow
              key={`${computer.vendor}/${computer.product}/${computer.address}`}
              label={computerLabel(computer)}
              value={
                computer.address === screen.connection?.address && computer.product === screen.product
                  ? t('diveForm.selected')
                  : undefined
              }
              onPress={() => screen.pickRemembered(computer)}
            />
          ))}
        </FormSection>
      ) : null}

      <FormSection title={t('ui.options')}>
        <OptionRow
          label={t('ui.forceDownloadingAllDives')}
          value={screen.force}
          disabled={running}
          onChange={screen.setForce}
        />
        <OptionRow
          label={t('ui.syncDiveComputerTime')}
          value={screen.syncTime}
          disabled={running}
          onChange={screen.setSyncTime}
        />
      </FormSection>

      {running ? (
        <View style={styles.progress}>
          <Progress fraction={status.fraction} />
          <Text style={[styles.progressText, { color: theme.textSecondary }]} numberOfLines={2}>
            {status.text || t('download.connecting')}
          </Text>
        </View>
      ) : null}

      {!running && outcome.kind !== 'none' ? (
        <View style={styles.outcome}>
          <Text
            style={[
              styles.outcomeTitle,
              { color: outcome.kind === 'failed' ? theme.danger : theme.text },
            ]}>
            {outcome.title}
          </Text>
          {outcome.detail !== '' ? (
            <Text selectable style={{ color: theme.textSecondary }}>
              {outcome.detail}
            </Text>
          ) : null}
        </View>
      ) : null}

      {running ? (
        <PrimaryButton label={t('ui.cancel')} onPress={screen.cancel} />
      ) : (
        <PrimaryButton
          label={screen.downloadLabel}
          prominent
          disabled={!screen.canDownload}
          onPress={screen.download}
        />
      )}

      {screen.shareLog && outcome.kind === 'failed' ? (
        <PrimaryButton label={t('ui.shareTheLog')} onPress={screen.shareLog} />
      ) : null}

      <ChoicePicker
        visible={picker === 'vendor'}
        title={t('ui.vendor')}
        choices={vendorChoices}
        selectedKey={screen.vendor}
        onSelect={(vendor) => {
          screen.setVendor(vendor);
          // Straight on to the model; nobody picks a vendor and stops.
          setPicker('product');
        }}
        onClose={close}
      />
      <ChoicePicker
        visible={picker === 'product'}
        title={screen.vendor}
        choices={productChoices}
        selectedKey={screen.product}
        onSelect={screen.setProduct}
        onClose={close}
      />
      <ChoicePicker
        visible={picker === 'connection'}
        title={t('ui.connection')}
        searchable={false}
        choices={connectionChoices}
        selectedKey={screen.connection?.address}
        emptyText={
          screen.scan.adapter === 'on' || screen.scan.adapter === 'unknown'
            ? t('download.looking')
            : (adapter ?? undefined)
        }
        footer={
          <View style={styles.pickerFooter}>
            <OptionRow
              label={t('ui.showAllBluetoothDevices')}
              value={screen.showAllDevices}
              onChange={screen.setShowAllDevices}
            />
            <PrimaryButton label={t('ui.rescan')} onPress={screen.rescan} />
          </View>
        }
        onSelect={screen.setConnection}
        onClose={close}
      />
    </ScrollView>
  );
}

function Review({ screen }: { screen: DiveComputerScreen }) {
  const theme = useTheme();
  const units = useUnits();
  const rows = useMemo(
    () => downloadedDiveRows(screen.status.dives, units),
    [screen.status.dives, units],
  );
  const count = screen.selected.size;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.outcome}>
        <Text style={[styles.outcomeTitle, { color: theme.text }]}>{screen.outcome.title}</Text>
        {screen.outcome.detail !== '' ? (
          <Text style={{ color: theme.textSecondary }}>{screen.outcome.detail}</Text>
        ) : null}
      </View>

      <View style={styles.selectionRow}>
        <Pressable accessibilityRole="button" onPress={screen.selectAll} hitSlop={Spacing.two}>
          <Text style={{ color: theme.accent, fontSize: 17 }}>{t('download.selectAll')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={screen.selectNone} hitSlop={Spacing.two}>
          <Text style={{ color: theme.accent, fontSize: 17 }}>{t('download.unselectAll')}</Text>
        </Pressable>
      </View>

      <FormSection>
        {rows.map((row) => {
          const checked = screen.selected.has(row.index);
          return (
            <Pressable
              key={row.index}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={`${row.dateText}, ${row.detailText}`}
              onPress={() => {
                selectionChanged();
                screen.toggle(row.index);
              }}
              style={({ pressed }) => [styles.diveRow, pressed ? { opacity: 0.6 } : null]}>
              <SymbolView
                name={checked ? 'checkmark.circle.fill' : 'circle'}
                size={24}
                tintColor={checked ? theme.accent : theme.textSecondary}
                fallback={<Text style={{ color: theme.accent }}>{checked ? '[x]' : '[ ]'}</Text>}
              />
              <View style={styles.diveText}>
                <Text style={{ color: theme.text, fontSize: 17 }}>{row.dateText}</Text>
                <Text style={{ color: theme.textSecondary }}>{row.detailText}</Text>
              </View>
            </Pressable>
          );
        })}
      </FormSection>

      {screen.accepting ? (
        <ActivityIndicator />
      ) : (
        <PrimaryButton
          label={t('download.accept.button', { count })}
          prominent
          disabled={count === 0}
          onPress={screen.accept}
        />
      )}
      <PrimaryButton label={t('ui.discard')} disabled={screen.accepting} onPress={screen.discard} />
    </ScrollView>
  );
}

function OptionRow({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.optionRow}>
      <Text style={[styles.optionLabel, { color: theme.text }]}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} />
    </View>
  );
}

/** A fraction of 0 means the device has not said how much is coming: it just runs. */
function Progress({ fraction }: { fraction: number }) {
  const theme = useTheme();
  if (fraction <= 0) {
    return <ActivityIndicator />;
  }
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
      style={[styles.track, { backgroundColor: theme.separator }]}>
      <View
        style={[
          styles.fill,
          { backgroundColor: theme.accent, width: `${Math.min(100, fraction * 100)}%` },
        ]}
      />
    </View>
  );
}

function PrimaryButton({
  label,
  prominent = false,
  disabled = false,
  onPress,
}: {
  label: string;
  prominent?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: prominent ? theme.accent : theme.backgroundElement },
        disabled ? { opacity: 0.4 } : null,
        pressed ? { opacity: 0.7 } : null,
      ]}>
      <Text style={[styles.buttonLabel, { color: prominent ? '#FFFFFF' : theme.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three },
  notice: { fontSize: 15 },
  progress: { gap: Spacing.two },
  progressText: { fontSize: 13 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%' },
  outcome: { gap: Spacing.one },
  outcomeTitle: { fontSize: 17, fontWeight: '600' },
  selectionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  optionLabel: { flex: 1, fontSize: 17 },
  diveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  diveText: { flex: 1, gap: 2 },
  button: {
    borderRadius: 12,
    paddingVertical: Spacing.two + 4,
    alignItems: 'center',
  },
  buttonLabel: { fontSize: 17, fontWeight: '600' },
  pickerFooter: { gap: Spacing.two },
});

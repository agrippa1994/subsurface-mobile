// AI-generated (Claude)
// Import and export, driven through the real C++ bindings (task 11).
//
// Three things are asserted here that nothing else covers:
//
//  1. A Suunto DM4 XML export arrives with a *decoded* profile. That file
//     carries its samples as base64 blobs which no core parser reads (see
//     cpp/bindings/suunto-xml.h), so without the decoder the dive would still
//     import - with a fabricated profile and no temperature or pressure at all.
//  2. Importing merges into the loaded logbook instead of replacing it, and
//     importing the same file twice merges rather than duplicates.
//  3. An exported logbook re-imports as the same logbook, which is the file
//     side of the interop requirement (opening it in desktop Subsurface is the
//     manual half; the model comparison is here).

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { fixture, snapshotLog, tempDir } from './harness/fixtures';
import { diffSnapshots } from './harness/parity';
import { SsrfHost } from './harness/ssrf-host';

const SUUNTO_DM4_XML = fixture('Dive_2013-02-02-1614.xml');
const SUUNTO_SDE = fixture('TestDiveDM3.SDE');
const DIVELOGS_DLD = fixture('TestDiveDivelogsDE.DLD');
const SAMPLE = fixture('abitofeverything.ssrf');
const SMALL_LOG = fixture('test29.xml');

const hosts: SsrfHost[] = [];

/** A host process with the stylesheets configured, closed after the test. */
async function newHost(): Promise<SsrfHost> {
  const host = new SsrfHost();
  hosts.push(host);
  await host.configure();
  return host;
}

afterEach(async () => {
  await Promise.all(hosts.splice(0).map((host) => host.close()));
});

describe('Suunto DM4 XML import', () => {
  it('decodes the profile blobs into samples, temperature and pressure', async () => {
    const host = await newHost();
    const result = await host.importFile(SUUNTO_DM4_XML);
    expect(result).toMatchObject({ added: 1, merged: 0, failed: 0, dives: 1 });

    const [summary] = await host.listDives();
    // Read off the file: StartTime 2013-02-02T16:14:08, MaxDepth 22.44,
    // Visibility 5, BottomTemperature 26 C.
    expect(summary.when).toBe(Date.UTC(2013, 1, 2, 16, 14, 8) / 1000);
    expect(summary.maxDepthMm).toBe(22440);
    expect(summary.visibility).toBe(5);
    expect(summary.waterTempMkelvin).toBe(299150);

    const dive = await host.getDive(summary.id);
    expect(dive.notes).toBe('Notes are here');
    // DiveTime 3540 s at SampleInterval 20 s.
    expect(dive.dcs[0].sampleCount).toBe(177);

    const profile = await host.getProfile(summary.id);
    const depths = profile.entry.map((entry) => entry.depthMm);
    expect(Math.max(...depths)).toBeGreaterThan(22000);

    // A fabricated profile has no temperature at all, so this is the assertion
    // that actually proves the TemperatureBlob was decoded. The file's blob is
    // whole degrees celsius between 26 and 28.
    const temperatures = profile.entry
      .map((entry) => entry.temperatureMkelvin)
      .filter((mkelvin) => mkelvin > 0);
    expect(temperatures.length).toBeGreaterThan(300);
    expect(Math.min(...temperatures)).toBe(299150);
    expect(Math.max(...temperatures)).toBe(301150);

    // Same for the PressureBlob: StartPressure 206520, EndPressure 53870.
    const pressures = profile.pressures.sensor.filter((mbar) => mbar > 0);
    expect(pressures.length).toBe(177);
    expect(Math.max(...pressures)).toBe(206520);
    expect(Math.min(...pressures)).toBeLessThan(60000);
    // Air is breathed, not made: the series has to fall.
    expect(pressures[0]).toBeGreaterThan(pressures[pressures.length - 1]);
  });

  it('merges rather than duplicates when the same file is imported twice', async () => {
    const host = await newHost();
    await host.importFile(SUUNTO_DM4_XML);
    const second = await host.importFile(SUUNTO_DM4_XML);

    expect(second).toMatchObject({ added: 0, merged: 1, dives: 1 });
    expect(await host.listDives()).toHaveLength(1);
  });
});

// The Suunto app exports one JSON per dive; upstream ships each of these with
// the SSRF file the desktop importer produces from it, so the XML companion is
// the expected result and the comparison below is a golden test against the
// core's own reference output.
const SUUNTO_JSON: { name: string; expectedDifferences: string[] }[] = [
  { name: 'suunto_ocean_air', expectedDifferences: [] },
  { name: 'suunto_eon_core_nitrox', expectedDifferences: [] },
  { name: 'suunto_nautic_sidemount', expectedDifferences: [] },
  {
    // The Suunto app writes a .fit next to the .json, and the Ocean's JSON
    // export carries neither the gas mix nor the gradient factors - the desktop
    // importer reads them out of the FIT file, which needs the libdivecomputer
    // download path this build does not compile (patch 0007). The dive itself,
    // profile included, comes out identical; the fields below are what the
    // missing FIT costs, and they are listed rather than filtered so that the
    // day FIT support lands, this test says so. CNS and OTU are on the list
    // because they are computed from the gas: without the FIT's 32% the dive
    // reads as air and the oxygen exposure comes out at nothing.
    name: 'suunto_ocean_nitrox',
    expectedDifferences: [
      '.dives.0.cylinders.0.gasmix.o2EffectivePermille: 209 -> 320',
      '.dives.0.cylinders.0.gasmix.o2Permille: 0 -> 320',
      '.dives.0.dcs.0.events.0.value: 21 -> 32',
      '.dives.0.dcs.0.extraData',
      '.dives.0.cns: 0 -> 5',
      '.dives.0.maxcns: 0 -> 5',
      '.dives.0.otu: 0 -> 7',
    ],
  },
];

// The XML fixtures store temperatures as text with two decimals ("29.24 C"),
// so a value that came out of the JSON as 302400 mK reads back as 302390. That
// is the file format rounding, not the importer.
const TEMPERATURE_ROUNDING_MK = 100;

function isTemperatureRounding(difference: string): boolean {
  const match = difference.match(/TempMkelvin: (\d+) -> (\d+)$/);
  return match !== null && Math.abs(Number(match[1]) - Number(match[2])) <= TEMPERATURE_ROUNDING_MK;
}

describe('Suunto JSON import', () => {
  it.each(SUUNTO_JSON)(
    'imports $name as the XML companion does',
    async ({ name, expectedDifferences }) => {
      const imported = await newHost();
      await imported.importFile(fixture(`${name}.json`));

      const reference = await newHost();
      await reference.loadFromXML(fixture(`${name}.xml`));

      const [fromJson, fromXml] = await Promise.all([
        snapshotLog(imported),
        snapshotLog(reference),
      ]);
      expect(fromJson.dives).toHaveLength(1);

      // Dive numbers are assigned when a dive joins a logbook, so an import into
      // an empty log numbers its dive 1 while the fixture - saved as a one-dive
      // file - has none. That is the only field the comparison drops; the
      // per-divecomputer timestamp the fixture gained on its way through the
      // writer is the documented first-save fixup (harness/parity.ts).
      const withoutNumber = (dives: { number: number }[]) =>
        dives.map(({ number: _number, ...rest }) => rest);
      const differences = diffSnapshots(
        { dives: withoutNumber(fromJson.dives) },
        { dives: withoutNumber(fromXml.dives) },
        { allowFixups: true },
      )
        .filter((difference) => !isTemperatureRounding(difference))
        // The extra-data difference carries both lists, so match it by path.
        .map((difference) =>
          difference.startsWith('.dives.0.dcs.0.extraData:')
            ? '.dives.0.dcs.0.extraData'
            : difference,
        );
      expect(differences.sort()).toEqual(expectedDifferences.sort());
    },
  );

  it('rejects JSON that is not a dive log', async () => {
    const notALog = join(tempDir('ssrf-json-'), 'notes.json');
    writeFileSync(notALog, '{"hello":"world"}\n');

    const host = await newHost();
    await expect(host.importFile(notALog)).rejects.toThrow();
    expect(await host.listDives()).toHaveLength(0);
  });
});

describe('zipped imports', () => {
  it('reads a Suunto .sde archive', async () => {
    const host = await newHost();
    const result = await host.importFile(SUUNTO_SDE);
    expect(result).toMatchObject({ added: 1, failed: 0 });

    const [summary] = await host.listDives();
    expect(summary.dcModel).toBe('Suunto Vyper');
    expect(summary.siteName).toBe('Hoodsport, WA Sund Rock');
    expect(summary.maxDepthMm).toBe(24690);
    expect((await host.getDive(summary.id)).dcs[0].sampleCount).toBeGreaterThan(0);
  });

  it('reads a divelogs.de .dld archive', async () => {
    const host = await newHost();
    expect(await host.importFile(DIVELOGS_DLD)).toMatchObject({ added: 1, failed: 0 });
    expect((await host.listDives())[0].buddy).toBe('Linus');
  });
});

describe('SSRF import', () => {
  it('merges into the loaded logbook, leaving the dives already there alone', async () => {
    const host = await newHost();
    await host.loadFromXML(SAMPLE);
    const before = await snapshotLog(host);

    const result = await host.importFile(SMALL_LOG);
    expect(result.added).toBe(4);
    expect(result.dives).toBe(before.dives.length + 4);

    const after = await snapshotLog(host);
    // The imported dives are older than the sample's, so they sort in ahead of
    // them; compare the sample's own dives by identity rather than by index.
    for (const dive of before.dives) {
      const still = after.dives.find((d) => d.when === dive.when && d.notes === dive.notes);
      expect(still).toBeDefined();
    }
  });

  it('replaces the logbook when loaded rather than imported', async () => {
    const host = await newHost();
    await host.loadFromXML(SAMPLE);
    await host.loadFromXML(SMALL_LOG);
    expect(await host.listDives()).toHaveLength(4);
  });

  it('reports a file it cannot make dives out of', async () => {
    const host = await newHost();
    await expect(host.importFile(fixture('TestComma.csv'))).rejects.toThrow();
    expect(await host.listDives()).toHaveLength(0);
  });
});

describe('export', () => {
  it('re-imports its own export as the same logbook', async () => {
    const workDir = tempDir('ssrf-export-');
    const exported = join(workDir, 'export.ssrf');

    const source = await newHost();
    await source.loadFromXML(SAMPLE);
    // Save once and reload: the first save of a file authored elsewhere
    // completes what the file left open (see harness/parity.ts), so the fixed
    // point starts at the second generation.
    await source.saveToXML(exported);
    const reference = await newHost();
    await reference.loadFromXML(exported);
    const expected = await snapshotLog(reference);
    await reference.saveToXML(exported);

    const importer = await newHost();
    const result = await importer.importFile(exported);
    expect(result.added).toBe(expected.dives.length);

    const imported = await snapshotLog(importer);
    expect(diffSnapshots(imported.dives, expected.dives)).toEqual([]);
    // Sites arrive with the dives that reference them, so a site nobody dived
    // is not carried over - that is the core's import path (process_imported_
    // dives), and it is why "import" and "open" are separate actions in the UI.
    const referenced = expected.sites.filter((site) => site.diveCount > 0);
    expect(imported.sites.map((site) => site.uuid).sort()).toEqual(
      referenced.map((site) => site.uuid).sort(),
    );
  });

  it('writes a Suunto import back out as SSRF', async () => {
    const workDir = tempDir('ssrf-export-suunto-');
    const exported = join(workDir, 'suunto.ssrf');

    const host = await newHost();
    await host.importFile(SUUNTO_DM4_XML);
    expect(await host.saveToXML(exported)).toMatchObject({ dives: 1 });

    const reopened = await newHost();
    await reopened.loadFromXML(exported);
    const dive = await reopened.getDive((await reopened.listDives())[0].id);
    // The decoded profile has to survive the trip through the file, otherwise
    // an imported dive would lose its samples on the next launch.
    expect(dive.dcs[0].sampleCount).toBe(177);
    expect(dive.maxDepthMm).toBe(22440);
  });
});

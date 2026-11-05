// AI-generated (Claude)
// An SSI logbook through the real parser: the converter's XML goes into the core
// and the assertions read what the core made of it. Only names and numbers invented
// for this file are used; the shapes follow real `get_divelog` records.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { plotPressureAt } from '../src/models';
import {
  convertSsiLogbookToSsrf,
  describeSsiImport,
  isSameDive,
} from '../src/models/ssi/ssrf-import';
import { tempDir } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

const hosts: SsrfHost[] = [];

async function newHost(): Promise<SsrfHost> {
  const host = new SsrfHost();
  hosts.push(host);
  await host.configure();
  return host;
}

afterEach(async () => {
  await Promise.all(hosts.splice(0).map((host) => host.close()));
});

function importXml(host: SsrfHost, xml: string) {
  const path = join(tempDir(), 'ssi.ssrf');
  writeFileSync(path, xml);
  return host.importFile(path);
}

const SAMPLES = [
  { n: 1, t: 5000, d: 1.5, te: 14.3, ndl: 99, dr: false, gn: 0, gs: 0, s: 0, a: 0, mf: 134217728 },
  { n: 2, t: 10000, d: 12, te: 12, ndl: 40, dr: false, pr: { t: 0, v: 190 } },
  { n: 3, t: 15000, d: 18, te: 11, ndl: 0, dr: true, de: { d: 3, t: 120, tts: 300 }, cn: 4 },
  { n: 4, t: 20000, d: 18, te: 11, ndl: 0, dr: true, pr: { t: 0, v: 180 }, hb: 90, b: 270 },
  { n: 5, t: 25000, d: -6, te: 12, ndl: 12, dr: false, pr: { t: 0, v: 70 } },
  { n: 6, t: 30000, d: 0, te: 13, ndl: 99, dr: false },
];

const DIVE = {
  odin_user_log_id: 501,
  odin_user_log_nr: 7,
  odin_user_log_date: '2026-03-08',
  odin_user_log_entry_time: '13:31',
  odin_user_log_datetime: '2026-03-08 13:31',
  odin_user_log_divetime: 42,
  odin_user_log_depth_m: 18,
  odin_user_log_avg_depth_m: 9.5,
  odin_user_log_watertemp_c: 11,
  odin_user_log_airtemp_c: 0,
  odin_user_log_airtemp_f: 32,
  odin_user_log_pressure_start_bar: 200,
  odin_user_log_pressure_end_bar: 70,
  odin_user_log_tank_vol_l: 15,
  odin_user_log_var_tanktype_id: 19,
  odin_user_log_var_watertype_id: 4,
  odin_user_log_var_entry_id: 22,
  odin_user_log_var_weather_id: 1,
  odin_user_log_var_divetype_id: 24,
  odin_user_log_var_specialdive_id: '40',
  odin_user_log_ean: 1,
  odin_user_log_ean_percent: 32,
  odin_user_log_weight_kg: 10,
  odin_user_log_vis_m: 15,
  odin_user_log_rating: 4,
  odin_user_log_cns_end: 3,
  odin_user_log_otu_end: 77,
  odin_user_log_si_before: 5880,
  odin_user_log_gf_set: '85 / 85',
  odin_user_log_gf_end: 17.9,
  odin_user_log_comment: 'Saw a <big> pike & a "perch"',
  odin_user_log_dive_sites_id: 2367,
  odin_user_log_buddy_ids: [11, 12, 999],
  odin_user_log_animal_ids: [3],
  odin_user_log_gear: [8],
  odin_user_log_leader_confirmed_name: 'Pat Example #130971',
  odin_user_log_divecenter_confirmed_name: 'Example Divers',
  odin_user_log_divecomputer_name: 'Puck4',
  odin_user_log_divecomputer_manufacturer: 'Mares',
  odin_user_log_divecomputer_serial_nr: '2417004981',
  odin_user_log_divecomputer_firmware: '01.04.04',
  odin_user_log_divecomputer_dive_ref: '2026-03-08T13:31:00.000_0',
  odin_user_log_tankPressureDataset: '',
  odin_user_log_alarmDataset: JSON.stringify([
    { position: 2, deco: false, speed: true, fast_ascent: true, violation: false },
    { position: 3, deco: false, speed: true, fast_ascent: false, violation: false },
    { position: 4, NODECO_2MIN: true },
  ]),
  odin_user_log_diveSamples: JSON.stringify(SAMPLES),
};

const LOGBOOK = {
  logbook_details: [
    DIVE,
    { ...DIVE, odin_user_log_id: 502, odin_user_log_deleted: 1, odin_user_log_date: '2026-03-09', odin_user_log_datetime: '2026-03-09 10:00' },
  ],
  logbook_sites: [
    {
      odin_dive_sites_id: 2367,
      odin_dive_sites_name: 'Example Lake',
      odin_dive_sites_lat: 47.5,
      odin_dive_sites_lon: 13.25,
      odin_dive_sites_meta_country: 'Austria',
    },
  ],
  logbook_buddies: [
    { id: 11, firstname: 'Alex', lastname: 'Sample' },
    { id: 12, nickname: 'Robin', deleted: 1 },
  ],
};

const LABELS = {
  tables: new Map<string, ReadonlyMap<number, string>>([
    ['entry', new Map([[22, 'Boat']])],
    ['weather', new Map([[1, 'Sunny']])],
    ['divetype', new Map([[24, 'Fun']])],
    ['tanktype', new Map([[19, 'Steel']])],
    ['specialdive', new Map([[40, 'Night']])],
  ]),
  wildlife: new Map([[3, 'Pike']]),
  gear: new Map([[8, 'Example Regulator']]),
};

describe('SSI logbook to SSRF', () => {
  it('maps everything SSRF has a place for, as the core reads it', async () => {
    const host = await newHost();
    const result = convertSsiLogbookToSsrf({ divelog: LOGBOOK, labels: LABELS });
    expect(result).toMatchObject({ dives: 1, sites: 1, alreadyPresent: 0, unreadable: 0 });

    expect(await importXml(host, result.xml)).toMatchObject({ added: 1, merged: 0, failed: 0 });

    const [summary] = await host.listDives();
    const dive = await host.getDive(summary.id);

    expect(new Date(dive.when * 1000).toISOString()).toBe('2026-03-08T13:31:00.000Z');
    expect(dive.number).toBe(7);
    expect(dive.rating).toBe(4);
    expect(dive.maxDepthMm).toBe(18000);
    expect(dive.buddy).toBe('Alex Sample, Robin');
    expect(dive.diveguide).toBe('Pat Example');
    expect(dive.tags).toEqual(expect.arrayContaining(['ssi', 'boat', 'night']));
    expect(dive.notes).toContain('Saw a <big> pike & a "perch"');
    expect(dive.notes).toContain('Visibility: 15 m');
    expect(dive.notes).toContain('Weather: Sunny');
    expect(dive.notes).toContain('Wildlife: Pike');
    expect(dive.notes).toContain('Gear: Example Regulator');
    expect(dive.notes).toContain('Dive center: Example Divers');
    expect(dive.totalWeightGrams).toBe(10000);
    // The higher of the logged 3% and the 4% one sample reached, by the core's rule.
    expect(dive.maxcns).toBe(4);

    expect(dive.cylinders[0]).toMatchObject({
      sizeMl: 15000,
      startMbar: 200000,
      description: 'Steel',
      gasmix: { o2Permille: 320 },
      // The core drops a manual end pressure equal to the last sample's reading.
      sampleEndMbar: 70000,
    });

    const dc = dive.dcs[0];
    expect(dc.model).toBe('Mares Puck4');
    expect(dc.surfaceTimeSec).toBe(5880);
    expect(dc.airTempMkelvin).toBe(273150);
    expect(dc.waterTempMkelvin).toBe(284150);
    expect(dc.salinity).toBe(10000);
    const extra = Object.fromEntries(dc.extraData.map(({ key, value }) => [key, value]));
    expect(extra).toMatchObject({
      Serial: '2417004981',
      'FW Version': '01.04.04',
      'GF Low': '85',
      'GF High': '85',
      'GF at end': '17.9',
      'CNS at end': '3',
      'OTU at end': '77',
      'SSI log id': '501',
      'SSI dive number': '7',
    });

    // Read back through the core's own writer, which is what ends up on disk.
    const saved = join(tempDir(), 'saved.ssrf');
    await host.saveToXML(saved);
    const lines = readFileSync(saved, 'utf8').split('\n');
    const line = (time: string) => lines.find((text) => text.includes(`sample time='${time} min'`));

    // On the sample each alarm began at, with a run counted once.
    const events = dc.events.map((event) => [event.timeSec, event.name]);
    expect(events).toEqual(expect.arrayContaining([[15, 'ascent'], [25, 'nodeco 2min']]));
    expect(dc.events.filter((event) => event.name === 'ascent')).toHaveLength(1);

    expect(line('0:05')).toContain("depth='1.5 m'");
    expect(line('0:05')).toContain("temp='14.3 C'");
    expect(line('0:05')).toContain("ndl='99:00 min'");
    expect(line('0:10')).toContain("pressure0='190.0 bar'");
    expect(line('0:10')).toContain("ndl='40:00 min'");
    // Zero is a reading: it must not inherit the 40 minutes before it.
    expect(line('0:15')).toContain("ndl='0:00 min'");
    expect(line('0:15')).toContain("in_deco='1'");
    expect(line('0:15')).toContain("stopdepth='3.0 m'");
    expect(line('0:15')).toContain("stoptime='2:00 min'");
    expect(line('0:15')).toContain("tts='5:00 min'");
    expect(line('0:15')).toContain("cns='4%'");
    expect(line('0:20')).toContain("heartbeat='90'");
    expect(line('0:20')).toContain("bearing='270'");
    // SSI's negative depth is the same depth.
    expect(line('0:25')).toContain("depth='6.0 m'");
    expect(line('0:25')).toContain("in_deco='0'");

    const [site] = await host.listDiveSites();
    expect(site).toMatchObject({ name: 'Example Lake', latUdeg: 47500000, lonUdeg: 13250000, hasGps: true });
    expect(site.taxonomy.map((entry) => entry.value)).toContain('Austria');
  });

  it('adds nothing on a second import, and reuses an existing site', async () => {
    const host = await newHost();
    await importXml(host, convertSsiLogbookToSsrf({ divelog: LOGBOOK, labels: LABELS }).xml);

    const again = convertSsiLogbookToSsrf({
      divelog: LOGBOOK,
      existingDives: await host.listDives(),
      existingSites: await host.listDiveSites(),
    });
    expect(again).toMatchObject({ dives: 0, alreadyPresent: 1 });
    expect(describeSsiImport(again)).toBe('0 dives added. 1 dive already in the logbook.');

    // A different dive at the same place lands on the site already there.
    const later = {
      ...LOGBOOK,
      logbook_details: [
        { ...DIVE, odin_user_log_id: 503, odin_user_log_datetime: '2026-04-01 09:00', odin_user_log_date: '2026-04-01' },
      ],
      logbook_sites: [
        { ...LOGBOOK.logbook_sites[0], odin_dive_sites_name: 'Example Lake North', odin_dive_sites_lon: 13.2501 },
      ],
    };
    const result = convertSsiLogbookToSsrf({
      divelog: later,
      existingDives: await host.listDives(),
      existingSites: await host.listDiveSites(),
    });
    expect(await importXml(host, result.xml)).toMatchObject({ added: 1, dives: 2, sites: 1 });
  });

  it('keeps a dive with no profile, and falls back to the summary fields', async () => {
    const host = await newHost();
    const manual = {
      odin_user_log_id: 9,
      odin_user_log_date: '2020-01-02',
      odin_user_log_entry_time: '09:05',
      odin_user_log_divetime: '30',
      odin_user_log_depth_ft: '100',
      odin_user_log_watertemp_f: 50,
      odin_user_log_pressure_start_psi: 3000,
    };
    const result = convertSsiLogbookToSsrf({ divelog: { logbook_details: [manual] } });
    await importXml(host, result.xml);

    const [summary] = await host.listDives();
    const dive = await host.getDive(summary.id);
    expect(dive.durationSec).toBe(1800);
    expect(dive.maxDepthMm).toBe(30480);
    expect(dive.dcs[0].model).toBe('manually added dive');
    expect(dive.dcs[0].waterTempMkelvin).toBe(283150);
    expect(Math.round(dive.cylinders[0].startMbar / 1000)).toBe(207);
  });

  it('spreads flat datasets over the logged time when there are no records', async () => {
    const host = await newHost();
    const flat = {
      odin_user_log_date: '2020-01-03',
      odin_user_log_entry_time: '10:00',
      odin_user_log_divetime: 1,
      odin_user_log_depth_m: 10,
      odin_user_log_depthDataset: '[3,10,10,0]',
      odin_user_log_tempDataset: '[20,18,18,19]',
      odin_user_log_tankPressureDataset: '[200,190,180,170]',
    };
    await importXml(host, convertSsiLogbookToSsrf({ divelog: { logbook_details: [flat] } }).xml);
    const [summary] = await host.listDives();
    const profile = await host.getProfile(summary.id);
    const at = (sec: number) => profile.entry.find((entry) => entry.sec === sec);
    expect(at(15)?.depthMm).toBe(3000);
    expect(at(30)?.depthMm).toBe(10000);
    expect(at(60)?.depthMm).toBe(0);
    expect(plotPressureAt(profile, profile.entry.indexOf(at(30)!), 0)).toBe(190000);
  });

  it('collapses duplicates and counts unreadable records', () => {
    const noDate = { odin_user_log_id: 1 };
    const result = convertSsiLogbookToSsrf({
      divelog: { logbook_details: [DIVE, { ...DIVE, odin_user_log_id: 777 }, noDate] },
    });
    expect(result).toMatchObject({ dives: 1, duplicates: 1, unreadable: 1 });
  });

  it('matches dives the way the core does', () => {
    const base = { when: 1000, durationSec: 2400, maxDepthMm: 18000, meanDepthMm: 9000 };
    expect(isSameDive(base, { ...base, when: 1600, maxDepthMm: 18400 })).toBe(true);
    expect(isSameDive(base, { ...base, when: 90000 })).toBe(false);
    expect(isSameDive(base, { ...base, maxDepthMm: 30000 })).toBe(false);
  });
});

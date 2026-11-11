// AI-generated (Claude)
import type en from '../en/surface-gf';

const surfaceGf: typeof en = {
  gf: 'Oberflächen-GF {{gf}}',
  ambient: {
    barometer: 'Barometer des Telefons, {{mbar}} mbar',
    altitude: 'Höheneinstellung, {{mbar}} mbar',
    seaLevel: 'Meereshöhe, {{mbar}} mbar',
    waiting: 'Warte auf das Barometer.',
    noBarometer: 'Dieses Telefon hat kein Barometer.',
    outOfRange: 'Der Barometerwert liegt außerhalb des gültigen Bereichs.',
  },
  preset: {
    minutes_one: '+{{count}} min',
    minutes_other: '+{{count}} min',
    hours_one: '+{{count}} h',
    hours_other: '+{{count}} h',
  },
  planned: {
    was: 'War {{clock}}',
    in: 'In {{duration}}, {{clock}}',
    beforeEnd: 'Vor dem Ende dieses Tauchgangs',
    accessibility: 'Geplanter Einstieg {{when}}. {{gf}}.',
  },
  duration: {
    minutes: '{{minutes}} min',
    hours: '{{hours}} h {{minutes}} min',
    days: '{{days}} d {{hours}} h',
  },
  clock: {
    tomorrow: 'morgen {{time}}',
    yesterday: 'gestern {{time}}',
  },
  disclaimer: 'Der Oberflächen-GF ist ein Wert des Bühlmann-Modells aus deinem aufgezeichneten Profil, keine Messung und kein medizinischer Rat.',
  singlePressureNote: 'Für das ganze Oberflächenintervall gilt ein einziger Umgebungsdruck. Eine Fahrt in die Höhe während des Intervalls wird nicht berücksichtigt.',
  explainer: 'Der Oberflächen-GF gibt an, wie nah dein führendes Gewebekompartiment an der Oberfläche an seiner Bühlmann-Grenze ist: 0 % bedeutet, dass kein Kompartiment mehr Stickstoff enthält als dem umgebenden Luftdruck entspricht, 100 % ist die Grenze selbst. Entsättigt bedeutet, dass jedes Kompartiment höchstens 2 % über dem Stickstoff liegt, den es in Ruhe enthält; der Kern vergisst einen Tauchgang nach 48 Stunden.',
  card: {
    since: 'Vor {{duration}} aufgetaucht',
    cleanAt: 'Entsättigt in {{duration}}, {{clock}}',
    zeroIn: '0 % in {{duration}}',
    aboveZero: 'Über 0 % für die ganze Reihe',
    residualClean: 'Reststickstoff, entsättigt in {{duration}}',
  },
  below: {
    staysAbove: 'Bleibt für die ganze Reihe über {{threshold}} %',
    already: 'Bereits bei oder unter {{threshold}} %',
    in: 'In {{duration}}, {{clock}}',
  },
  span: {
    all: 'Alle',
  },
  cursor: {
    now: 'Jetzt, {{clock}}',
    ahead: '{{clock}}, in {{duration}}',
    ago: '{{clock}}, vor {{duration}}',
    accessibility: 'Oberflächen-GF {{gf}} um {{when}}. {{phase}}.',
  },
  phase: {
    diving: 'Vor dem Ende des Tauchgangs',
    supersaturated: 'Übersättigt',
    residual: 'Reststickstoff',
    clean: 'Entsättigt',
  },
};

export default surfaceGf;

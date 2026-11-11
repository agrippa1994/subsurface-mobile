// AI-generated (Claude)
import type en from '../en/profile';

const profile: typeof en = {
  readout: {
    ndl: 'NDL',
    tts: 'TTS',
    calc: '{{name}} {{value}}',
    fresh: 'frisch {{name}} {{value}}',
    gf: 'GF {{value}}',
    surfaceGf: 'sGF {{value}}',
    dcCeiling: 'DC-Deko-Grenze {{value}}',
    dcNdl: 'DC NDL {{value}}',
    dcTts: 'DC TTS {{value}}',
    calcCeiling: 'Ber. Deko-Grenze {{value}}',
  },
  summary: {
    noSamples: 'Tauchprofil. Dieser Tauchgang hat keine Profilwerte.',
    text: 'Tauchprofil. {{parts}}.',
    maxDepth: 'maximale Tiefe {{depth}} bei {{time}}',
    totalTime: 'Gesamtzeit {{time}}',
    waterTemperature: 'Wassertemperatur {{temperature}}',
    waterTemperatureRange: 'Wassertemperatur {{min}} bis {{max}}',
    tankPressure: 'Flaschendruck von {{from}} bis {{to}}',
    residual: 'beginnt mit Stickstoff aus einem Tauchgang {{interval}} zuvor',
    deco: 'der Tauchgang wurde zum Dekompressionstauchgang',
    noDeco: 'keine Dekompressionspflicht',
    dcCeiling: 'tiefste Deko-Grenze des Tauchcomputers {{depth}}',
    calcCeiling: 'tiefste berechnete Deko-Grenze {{depth}}',
    gfNow: 'höchster Gradientenfaktor in der Tiefe {{percent}} Prozent',
    gfSurface: 'höchster Oberflächen-Gradientenfaktor {{percent}} Prozent',
    events_one: '{{count}} Ereignis',
    events_other: '{{count}} Ereignisse',
  },
};

export default profile;

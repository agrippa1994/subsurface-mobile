// AI-generated (Claude)
import type en from '../en/tools';

const tools: typeof en = {
  planner: {
    title: 'Tauchgangsplaner',
    summary: 'Laufzeit, Stopps und Gas für einen geplanten Tauchgang',
  },
  gas: {
    title: 'Gasrechner',
    summary: 'MOD und END jedes Gemischs und das beste Gemisch für eine Tiefe',
  },
  nitrox: {
    title: 'Nitrox',
    summary: 'MOD, bestes Gemisch und Nullzeit im Vergleich zu Luft',
  },
  surfaceGf: {
    title: 'Oberflächen-GF',
    summary: 'Entsättigung nach deinem letzten Tauchgang, jetzt und bei deinem nächsten Einstieg',
  },
};

export default tools;

// AI-generated (Claude)
import type en from '../en/nitrox';

const nitrox: typeof en = {
  ndlOver: 'Über 300 min',
  compare: {
    neither: 'Keines der Gase erreicht innerhalb von 300 min eine Grenze',
    moreThan: 'Mehr als {{minutes}} min länger als mit Luft',
    shorter: 'Kürzer als mit Luft',
    same: 'Gleich wie mit Luft',
    longerBy: '{{minutes}} min länger als mit Luft{{percent}}',
    shorterBy: '{{minutes}} min kürzer als mit Luft{{percent}}',
  },
  warning: {
    contingency: 'Der pO2 in dieser Tiefe beträgt {{po2}} und überschreitet die Notfallgrenze von 1,60 bar.',
    working: 'Der pO2 in dieser Tiefe beträgt {{po2}} und überschreitet die Arbeitsgrenze von {{limit}}.',
  },
};

export default nitrox;

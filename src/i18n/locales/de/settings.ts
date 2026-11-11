// AI-generated (Claude)
import type en from '../en/settings';

const settings: typeof en = {
  footer: {
    newDives: 'Neue Tauchgänge beginnen mit dieser Flasche, ebenso Flaschen, die im Editor und im Planer hinzugefügt werden. Auch ein von einem Computer heruntergeladener Tauchgang ohne Angabe der Flaschengröße erhält sie. Sie ist anfangs mit ihrem Betriebsdruck gefüllt; den Enddruck trägst du beim Tauchgang ein.',
    decompression: 'Bühlmann-Gradientenfaktoren in Prozent. Sie bestimmen die berechnete Dekompressionsgrenze und die Gradientenfaktor-Kurven - niedriger ist konservativer. Die Standardwerte von Subsurface sind 30 und 75.',
    profile: 'Wird in jedem Tauchprofil und im Planer gezeichnet. GF in der Tiefe ist das führende Gewebe im Verhältnis zu seiner Grenze in diesem Moment, Oberflächen-GF das, was der Taucher beim sofortigen Auftauchen mitnehmen würde. Die Dekompressionsgrenze des Tauchcomputers ist die Stopptiefe, die der Computer angezeigt hat; die berechnete Dekompressionsgrenze ermittelt Subsurface aus den Messwerten mit den obigen Gradientenfaktoren, und sie kann um Meter abweichen. Das 3-m-Raster legt die Tiefenlinien auf Vielfache von drei, auch in Fuß.',
  },
  profileToggle: {
    showDcCeiling: 'Deko-Grenze des Tauchcomputers',
    showCalcCeiling: 'Berechnete Deko-Grenze',
    showGfNow: 'GF in der Tiefe',
    showGfSurface: 'Oberflächen-GF',
    threeMeterGrid: '3-m-Tiefenraster',
  },
};

export default settings;

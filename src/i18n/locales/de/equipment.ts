// AI-generated (Claude)
import type en from '../en/equipment';

const equipment: typeof en = {
  cylinder: {
    sizeInvalid: 'Die Größe ist keine Zahl.',
    workingPressureInvalid: 'Der Betriebsdruck ist keine Zahl.',
    startInvalid: 'Der Anfangsdruck ist keine Zahl.',
    endInvalid: 'Der Enddruck ist keine Zahl.',
    o2Invalid: 'Sauerstoff muss ein Prozentwert zwischen 0 und 100 sein.',
    heInvalid: 'Helium muss ein Prozentwert zwischen 0 und 100 sein.',
    mixTooRich: 'Sauerstoff und Helium zusammen dürfen 100 % nicht überschreiten.',
    endAboveStart: 'Der Enddruck darf nicht über dem Anfangsdruck liegen.',
    none: 'Keine',
  },
  weight: {
    invalid: 'Das Gewicht ist keine Zahl.',
  },
};

export default equipment;

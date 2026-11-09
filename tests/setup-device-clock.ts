// AI-generated (Claude)
// Every test file formats dates as a British phone with a 24-hour clock would,
// unless it sets the clock itself: the presentation model follows the device
// (src/models/date-format.ts), and Node's own default locale varies by machine.

import { setDeviceClock } from '../src/models/date-format';

setDeviceClock({ locale: 'en-GB', uses24Hour: true });

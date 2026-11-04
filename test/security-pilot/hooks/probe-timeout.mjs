// Observation 5 (timeout): marks, then outlives the policy timeout.
import { mark } from './_marker.mjs';
mark('probe-timeout');
setTimeout(() => {}, 60000);

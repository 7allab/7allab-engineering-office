// Observation 5 (error): marks, then fails with a non-2 exit code (a plain hook error).
import { mark } from './_marker.mjs';
mark('probe-error');
throw new Error('PILOT_DELIBERATE_HOOK_ERROR');

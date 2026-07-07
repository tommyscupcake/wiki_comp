import * as localDb from './localService';
import * as liveDb from './liveService';

const MODE = process.env.NEXT_PUBLIC_API_MODE || 'local';

export const db = MODE === 'live' ? liveDb : localDb;

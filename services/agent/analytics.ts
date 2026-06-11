import { appendFile, mkdirSync } from 'fs';
import { join } from 'path';

const LOG_DIR  = join(process.cwd(), 'logs');
const LOG_PATH = join(LOG_DIR, 'events.ndjson');

try { mkdirSync(LOG_DIR, { recursive: true }); } catch {}

type TrackContext = { sessionId?: string; userId?: string };

export const Analytics = {
    track(
        eventName: string,
        properties: Record<string, unknown>,
        ctx: TrackContext = {},
    ): void {
        const line = JSON.stringify({
            session_id: ctx.sessionId,
            user_id:    ctx.userId,
            timestamp:  new Date().toISOString(),
            event_name: eventName,
            properties,
        }) + '\n';

        appendFile(LOG_PATH, line, err => {
            if (err) console.warn('[analytics] write failed:', err.message);
        });
    },
};

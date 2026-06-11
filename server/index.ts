// Load environment variables BEFORE importing any agent module, because
// services/agent/config.ts reads process.env at import time.
import 'dotenv/config';

import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { AgentExecutor } from '../services/agent/executor';
import { AGENT_CONFIG } from '../services/agent/config';
import { Analytics } from '../services/agent/analytics';
import type { AgentGeoPoint } from '../services/agent/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dirname, '../web');
const PORT = Number(process.env.PORT || 3000);

// In-memory session store: each browser session keeps its own AgentExecutor so
// conversation history, memory facts, and pending action drafts persist.
const executors = new Map<string, AgentExecutor>();

const getExecutor = (sessionId: string, userId: string): AgentExecutor => {
    let executor = executors.get(sessionId);
    if (!executor) {
        executor = new AgentExecutor(userId);
        executors.set(sessionId, executor);
    }
    return executor;
};

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(WEB_DIR));

app.get('/api/health', (_req, res) => {
    res.json({
        ok: true,
        deepseekConfigured: AGENT_CONFIG.DEEPSEEK_ENABLED,
        fastModel: AGENT_CONFIG.FAST_MODEL,
        reasoningModel: AGENT_CONFIG.REASONING_MODEL,
    });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, location } = req.body as {
            message?: string;
            location?: AgentGeoPoint | null;
        };

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: 'message is required' });
        }

        const sessionId = (req.body.sessionId as string) || randomUUID();
        const userId = (req.body.userId as string) || `web_${sessionId}`;

        const executor = getExecutor(sessionId, userId);
        if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
            executor.setDeviceLocation(location);
        }

        const response = await executor.process(message);

        res.json({
            sessionId,
            reply: response.finalAnswer,
            steps: response.steps,
            actionPayload: response.actionPayload ?? null,
        });
    } catch (error: any) {
        console.error('[server] /api/chat failed:', error);
        res.status(500).json({ error: error?.message || 'internal error' });
    }
});

app.post('/api/feedback', (req, res) => {
    const { sessionId, query, response, rating } = req.body as {
        sessionId?: string;
        query?: string;
        response?: string;
        rating?: 'good' | 'bad';
    };
    Analytics.track(
        'user_feedback',
        { query, response, rating },
        { sessionId },
    );
    res.json({ ok: true });
});

app.post('/api/reset', (req, res) => {
    const sessionId = req.body?.sessionId as string | undefined;
    if (sessionId) executors.delete(sessionId);
    res.json({ ok: true });
});

app.listen(PORT, () => {
    console.log(`\nCampusAgent server running at http://localhost:${PORT}`);
    if (!AGENT_CONFIG.DEEPSEEK_ENABLED) {
        console.warn('[server] WARNING: DeepSeek API key not configured. Set EXPO_PUBLIC_DEEPSEEK_API_KEY in .env');
    }
});

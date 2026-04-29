/*
  ╔══════════════════════════════════════════════════════╗
  ║   AI Energy Advisor — Express Router (plug-and-play) ║
  ╚══════════════════════════════════════════════════════╝

  USAGE:
    // In your server.js / app.js:
    const aiRoutes = require('./ai-advisor/routes');
    app.use('/api/ai', aiRoutes(appliance));

  That's it. Two endpoints are added:
    POST /api/ai/analyze   → full AI analysis
    GET  /api/ai/stats     → raw aggregated stats
*/

const express = require('express');
const { createAdvisor } = require('./ai-advisor');

/**
 * Creates an Express router with AI advisor endpoints.
 *
 * @param {Object}   appliance        - reference to your in-memory appliance state object
 * @param {Object}   [advisorConfig]  - optional config passed to createAdvisor()
 * @returns {express.Router}
 *
 * Your appliance object should have this shape:
 *   {
 *     name:          'LED Light Bulb',
 *     state:         true/false,
 *     watts_per_min: 1,
 *     total_watts:   0,
 *     turned_on_at:  null | timestamp,
 *     logs:          [{ event: 'ON'|'OFF', time: '2:00 PM', total_watts: 0 }]
 *   }
 */
function createAIRoutes(appliance, advisorConfig = {}) {
  const router  = express.Router();
  const advisor = createAdvisor({
    apiKey:     advisorConfig.apiKey     || process.env.ANTHROPIC_API_KEY || null,
    model:      advisorConfig.model      || process.env.CLAUDE_MODEL || undefined,
    costPerKwh: advisorConfig.costPerKwh || undefined,
    currency:   advisorConfig.currency   || undefined
  });

  const getMappedAppliance = () => ({
    name: appliance.name,
    state: appliance.status === "ON",
    watts_per_min: appliance.watts_per_minute,
    total_watts: appliance.energy_watt_min,
    turned_on_at: appliance.turned_on_at,
    logs: []
  });

  // ── POST /analyze ─────────────────────────────────────
  // Full AI analysis: aggregates data → Claude API (or fallback)
  router.post('/analyze', async (req, res) => {
    try {
      console.log('[AI-ADVISOR] Analysis requested...');
      const result = await advisor.analyze(getMappedAppliance());
      console.log(`[AI-ADVISOR] Done (source: ${result.source})`);
      res.json(result);
    } catch (err) {
      console.error('[AI-ADVISOR] Error:', err.message);
      res.status(500).json({ error: 'AI analysis failed', message: err.message });
    }
  });

  // ── GET /stats ────────────────────────────────────────
  // Raw aggregated stats (no AI call, instant)
  router.get('/stats', (req, res) => {
    const stats = advisor.aggregateStats(getMappedAppliance());
    res.json(stats);
  });

  return router;
}

module.exports = createAIRoutes;

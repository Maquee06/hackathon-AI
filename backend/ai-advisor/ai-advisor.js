/*
  ╔══════════════════════════════════════════════════════╗
  ║   AI Energy Advisor — Core Module                    ║
  ║   Plug-and-play energy conservation advisor          ║
  ╚══════════════════════════════════════════════════════╝

  USAGE:
    const { createAdvisor } = require('./ai-advisor/ai-advisor');
    const advisor = createAdvisor({ apiKey: 'sk-ant-...' });

    const result = await advisor.analyze({
      name:          'LED Light Bulb',
      state:         true,
      watts_per_min: 1,
      total_watts:   12.5,
      turned_on_at:  Date.now() - 600000,   // 10 min ago
      logs:          [{ event: 'ON', time: '2:00 PM', total_watts: 0 }]
    });

    console.log(result.html);   // HTML-formatted suggestions
    console.log(result.stats);  // aggregated data
    console.log(result.source); // 'claude' | 'rule-based' | 'fallback'
*/

// ══════════════════════════════════════════════════════
//  CONFIGURATION DEFAULTS
// ══════════════════════════════════════════════════════
const DEFAULTS = {
  model:        'claude-sonnet-4-20250514',
  maxTokens:    1024,
  costPerKwh:   11.5,    // ₱ per kWh — change for your region
  currency:     '₱',
  apiVersion:   '2023-06-01'
};


// ══════════════════════════════════════════════════════
//  ENERGY DATA AGGREGATION
// ══════════════════════════════════════════════════════

/**
 * Aggregates raw appliance data into meaningful statistics.
 * Works with any object that has the expected shape.
 *
 * @param {Object} appliance
 * @param {string}  appliance.name          - display name
 * @param {boolean} appliance.state         - true = ON
 * @param {number}  appliance.watts_per_min - consumption rate
 * @param {number}  appliance.total_watts   - cumulative watts stored
 * @param {number|null} appliance.turned_on_at - timestamp when turned ON
 * @param {Array}   appliance.logs          - array of { event, time, total_watts }
 * @param {Object}  [options]               - optional overrides
 * @param {number}  [options.costPerKwh]    - electricity rate
 * @param {string}  [options.currency]      - currency symbol
 * @returns {Object} enriched stats
 */
function aggregateStats(appliance, options = {}) {
  const costPerKwh = options.costPerKwh || DEFAULTS.costPerKwh;
  const currency   = options.currency   || DEFAULTS.currency;
  const now = Date.now();

  // Current session watts (if appliance is ON)
  let sessionWatts   = 0;
  let sessionMinutes = 0;
  if (appliance.state && appliance.turned_on_at) {
    sessionMinutes = (now - appliance.turned_on_at) / 60000;
    sessionWatts   = sessionMinutes * (appliance.watts_per_min || 1);
  }

  const totalWatts = (appliance.total_watts || 0) + sessionWatts;

  // Analyze usage logs for patterns
  const logs       = appliance.logs || [];
  const onEvents   = logs.filter(l => l.event === 'ON');
  const offEvents  = logs.filter(l => l.event === 'OFF');
  const toggleCount = logs.length;

  // Estimate total ON-time
  let totalOnMinutes = sessionMinutes;
  if (offEvents.length > 0) {
    const lastOff = offEvents[offEvents.length - 1];
    totalOnMinutes += (lastOff.total_watts || 0) / (appliance.watts_per_min || 1);
  }

  // Cost projections
  const kWh                  = totalWatts / 1000;
  const currentCost          = kWh * costPerKwh;
  const hoursTracked         = totalOnMinutes / 60 || 1;
  const wattsPerHour         = totalWatts / hoursTracked;
  const projectedDailyKWh    = (wattsPerHour * 24) / 1000;
  const projectedDailyCost   = projectedDailyKWh * costPerKwh;
  const projectedMonthlyCost = projectedDailyCost * 30;

  // Usage intensity
  let intensityLevel = 'low';
  if (totalWatts >= 30) intensityLevel = 'high';
  else if (totalWatts >= 15) intensityLevel = 'moderate';

  return {
    appliance_name:    appliance.name || 'Unknown Appliance',
    is_on:             !!appliance.state,
    watts_per_min:     appliance.watts_per_min || 1,
    total_watts:       parseFloat(totalWatts.toFixed(2)),
    session_minutes:   parseFloat(sessionMinutes.toFixed(1)),
    total_on_minutes:  parseFloat(totalOnMinutes.toFixed(1)),
    toggle_count:      toggleCount,
    on_events:         onEvents.length,
    off_events:        offEvents.length,
    intensity_level:   intensityLevel,
    cost: {
      current:          parseFloat(currentCost.toFixed(4)),
      projected_daily:  parseFloat(projectedDailyCost.toFixed(4)),
      projected_monthly: parseFloat(projectedMonthlyCost.toFixed(2)),
      rate_per_kwh:     costPerKwh,
      currency
    },
    timestamp: new Date().toISOString()
  };
}


// ══════════════════════════════════════════════════════
//  PROMPT BUILDER
// ══════════════════════════════════════════════════════

function buildPrompt(stats) {
  const c = stats.cost;
  return `You are an AI energy conservation advisor for a smart home IoT app.

## Current Appliance Data
- Appliance: ${stats.appliance_name}
- Status: ${stats.is_on ? 'ON' : 'OFF'}
- Consumption rate: ${stats.watts_per_min} watt(s) per minute
- Total energy consumed: ${stats.total_watts} watts
- Current session duration: ${stats.session_minutes} minutes
- Total ON-time tracked: ${stats.total_on_minutes} minutes
- Toggle count: ${stats.toggle_count}
- Usage intensity: ${stats.intensity_level}

## Cost Data (${c.currency})
- Current cost: ${c.currency}${c.current}
- Projected daily cost: ${c.currency}${c.projected_daily}
- Projected monthly cost: ${c.currency}${c.projected_monthly}
- Rate: ${c.currency}${c.rate_per_kwh}/kWh

## Your Task
1. **Usage Summary** (1-2 sentences): Describe what the data shows.
2. **Conservation Tips** (exactly 3 bullet points): Specific, actionable tips referencing the numbers.
3. **Cost Alert**: If projected monthly cost exceeds ${c.currency}5, flag it. If ON for 10+ minutes, recommend turning off.
4. **Savings Estimate**: How much the user could save by following your tips.

Format using HTML: <strong> for emphasis, <ul><li> for tips.
Be concise — under 200 words total. Be specific, not generic.`;
}


// ══════════════════════════════════════════════════════
//  FALLBACK RULE-BASED ADVISOR
// ══════════════════════════════════════════════════════

function fallbackAnalysis(stats) {
  const c    = stats.cost;
  const tips = [];
  let summary = '';
  let alert   = '';

  // Summary
  if (stats.intensity_level === 'high') {
    summary = `<strong>High usage detected.</strong> Your ${stats.appliance_name} has consumed ${stats.total_watts}W over ${stats.total_on_minutes} min — above average.`;
  } else if (stats.intensity_level === 'moderate') {
    summary = `Your ${stats.appliance_name} has consumed <strong>${stats.total_watts}W</strong>. Usage is moderate but worth monitoring.`;
  } else {
    summary = `Your ${stats.appliance_name} has used <strong>${stats.total_watts}W</strong>. Usage is currently low — keep it up!`;
  }

  // Tip 1: state-based
  if (stats.is_on && stats.session_minutes > 10) {
    tips.push(`Appliance ON for <strong>${stats.session_minutes.toFixed(0)} min</strong> straight. Turn it off if not needed.`);
  } else if (stats.is_on) {
    tips.push(`Appliance is ON. Set a reminder to turn it off when leaving.`);
  } else {
    tips.push(`Good — appliance is OFF. Only turn on when actively needed.`);
  }

  // Tip 2: toggle-based
  if (stats.toggle_count > 6) {
    tips.push(`Toggled <strong>${stats.toggle_count} times</strong>. Frequent cycles waste energy — consolidate usage.`);
  } else {
    tips.push(`Use timers or schedules to automate and reduce unnecessary ON-time by up to 30%.`);
  }

  // Tip 3: cost-based
  if (c.projected_monthly > 5) {
    tips.push(`Projected <strong>${c.currency}${c.projected_monthly}/month</strong>. Cutting 2 hours daily saves ~${c.currency}${(c.projected_monthly * 0.25).toFixed(2)}/month.`);
  } else {
    tips.push(`Monthly cost is ${c.currency}${c.projected_monthly}. Upgrading to energy-efficient appliances can reduce this further.`);
  }

  // Alerts
  if (stats.is_on && stats.session_minutes > 10) {
    alert += `<strong style="color:#ff4d00">⚠ Alert:</strong> Running for ${stats.session_minutes.toFixed(0)} min continuously. Consider turning off. `;
  }
  if (c.projected_monthly > 5) {
    alert += `<strong style="color:#ff4d00">⚠ Cost Warning:</strong> Projected monthly cost (${c.currency}${c.projected_monthly}) exceeds ${c.currency}5.`;
  }

  const tipsHtml = '<ul>' + tips.map(t => `<li>${t}</li>`).join('') + '</ul>';

  return {
    html: `<p>${summary}</p>${tipsHtml}${alert ? `<p>${alert}</p>` : ''}`,
    source: 'rule-based'
  };
}


// ══════════════════════════════════════════════════════
//  CLAUDE API CALL
// ══════════════════════════════════════════════════════

async function callClaude(apiKey, prompt, model, maxTokens) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': DEFAULTS.apiVersion
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Claude API ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return (data.content || []).map(b => b.text || '').join('');
}


// ══════════════════════════════════════════════════════
//  FACTORY: createAdvisor
// ══════════════════════════════════════════════════════

/**
 * @param {Object}  [config]
 * @param {string}  [config.apiKey]     - Anthropic API key (omit for rule-based only)
 * @param {string}  [config.model]      - Claude model name
 * @param {number}  [config.maxTokens]  - max response tokens
 * @param {number}  [config.costPerKwh] - electricity rate for your region
 * @param {string}  [config.currency]   - currency symbol
 */
function createAdvisor(config = {}) {
  const apiKey    = config.apiKey    || null;
  const model     = config.model     || DEFAULTS.model;
  const maxTokens = config.maxTokens || DEFAULTS.maxTokens;
  const costOpts  = {
    costPerKwh: config.costPerKwh || DEFAULTS.costPerKwh,
    currency:   config.currency   || DEFAULTS.currency
  };

  return {
    /**
     * Analyze appliance data and return conservation suggestions.
     * @param {Object} appliance - appliance state object (see aggregateStats docs)
     * @returns {Promise<{html: string, stats: Object, source: string}>}
     */
    async analyze(appliance) {
      const stats  = aggregateStats(appliance, costOpts);
      const prompt = buildPrompt(stats);

      let html   = '';
      let source = 'claude';

      if (apiKey) {
        try {
          html = await callClaude(apiKey, prompt, model, maxTokens);
        } catch (err) {
          console.error('[AI-ADVISOR] Claude failed, using fallback:', err.message);
          const fb = fallbackAnalysis(stats);
          html   = fb.html;
          source = 'fallback';
        }
      } else {
        const fb = fallbackAnalysis(stats);
        html   = fb.html;
        source = 'rule-based';
      }

      return { html, stats, source };
    },

    aggregateStats: (appliance) => aggregateStats(appliance, costOpts)
  };
}


// ══════════════════════════════════════════════════════
module.exports = { createAdvisor, aggregateStats, fallbackAnalysis };

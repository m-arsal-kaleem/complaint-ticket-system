const keywords = require('../config/priorityKeywords.json');

function normalize(text) {
  if (!text) return '';
  return text.toLowerCase();
}

function detectPriorityDetailed(text) {
  const normalized = normalize(text);
  const scores = { high: 0, medium: 0, low: 0 };
  const matches = { high: [], medium: [], low: [] };

  // For multi-word keywords, check phrase first
  Object.keys(keywords).forEach((level) => {
    // sort keywords by length desc to match longer phrases first
    const kwList = keywords[level].slice().sort((a, b) => b.length - a.length);
    kwList.forEach((kw) => {
      // simple word/phrase match
      if (normalized.includes(kw.toLowerCase())) {
        scores[level] += 1;
        matches[level].push(kw);
      }
    });
  });

  // Choose priority by highest score; tie-breaker: high > medium > low
  let chosen = 'medium';
  if (scores.high > scores.medium && scores.high > scores.low) chosen = 'high';
  else if (scores.medium > scores.high && scores.medium > scores.low)
    chosen = 'medium';
  else if (scores.low > scores.high && scores.low > scores.medium)
    chosen = 'low';
  else {
    // tie or all zero -> fallback rules
    if (scores.high > 0) chosen = 'high';
    else if (scores.medium > 0) chosen = 'medium';
    else if (scores.low > 0) chosen = 'low';
    else chosen = null; // no match
  }

  return { priority: chosen, scores, matches };
}

function detectPriority(text) {
  const result = detectPriorityDetailed(text);
  // If no keyword matched, default to 'medium' to be safe
  return result.priority || 'medium';
}

module.exports = { detectPriority, detectPriorityDetailed };

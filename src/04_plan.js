import fs from 'fs';
import { readText, writeJSON, trim } from './utils.js';

const [,, sectionsPath, mappingPath, schemaPath, outPath] = process.argv;
if (!sectionsPath || !mappingPath || !schemaPath || !outPath) {
  console.error('Usage: node src/04_plan.js output/sections.json config/mapping.json config/slide.schema.json output/slides_plan.json');
  process.exit(1);
}

const sections = JSON.parse(readText(sectionsPath)).sections;
const mapping = JSON.parse(readText(mappingPath));

// 簡易テンプレ制約(MVP)
const constraintsByTpl = {
  title_card: { maxCharsPerLine: 26, maxLines: 3 },
  definition: { maxCharsPerLine: 26, maxLines: 4 },
  bullets: { maxCharsPerLine: 26, maxLines: 6, maxBullets: 5 },
  comparison: { maxCharsPerLine: 24, maxLines: 6 },
  process: { maxCharsPerLine: 24, maxLines: 6, maxSteps: 5 },
  diagram: { maxCharsPerLine: 22, maxLines: 6 },
  illustration: { maxCharsPerLine: 26, maxLines: 4 },
  recap: { maxCharsPerLine: 26, maxLines: 6 },
  cta: { maxCharsPerLine: 24, maxLines: 4 }
};

const chooseTemplate = (sec) => {
  const cands = mapping[sec.intent] || mapping.point || ['bullets'];
  // ヒューリスティック
  if (sec.intent === 'comparison') return 'comparison';
  if (sec.intent === 'process') return 'process';
  if (sec.lines.length <= 2 && cands.includes('definition')) return 'definition';
  if (cands.includes('bullets')) return 'bullets';
  return cands[0] || 'title_card';
};

const cut = (s, n) => (s.length <= n ? s : s.slice(0, n) + '…');

const toFields = (tpl, sec) => {
  const text = sec.lines.join(' ');
  switch (tpl) {
    case 'title_card':
      return { title: sec.summary, subtitle: cut(text, 40) };
    case 'definition':
      return { term: cut(sec.summary, 16), desc: cut(text, 100) };
    case 'bullets': {
      const items = sec.lines.slice(0, 5).map(v => cut(v, 30));
      return { title: sec.summary, items };
    }
    case 'process': {
      const steps = sec.lines.flatMap(l => l.split(/→|=>|＞|>/)).map(v => v.trim()).filter(Boolean).slice(0, 5);
      return { title: sec.summary, steps: steps.length ? steps : sec.lines.slice(0,5) };
    }
    case 'comparison': {
      const left = (sec.lines[0] || '').split(/、|,|・/).slice(0,3);
      const right = (sec.lines[1] || '').split(/、|,|・/).slice(0,3);
      const criteria = ['特徴','強み','弱み'].slice(0, Math.max(left.length, right.length));
      return { title: sec.summary, left, right, criteria };
    }
    case 'recap': {
      const points = sec.lines.slice(0, 5).map(v => cut(v, 28));
      return { title: 'まとめ', points };
    }
    case 'cta':
      return { message: cut(text, 40), link: '' };
    default:
      return { title: sec.summary, body: cut(text, 100) };
  }
};

const estimateLines = (tpl, fields) => {
  const maxChars = constraintsByTpl[tpl]?.maxCharsPerLine || 26;
  const measure = (s) => Math.ceil((s || '').length / maxChars);
  switch (tpl) {
    case 'bullets': return (fields.items || []).reduce((a, b) => a + measure(b), 0) + 1;
    case 'process': return (fields.steps || []).reduce((a, b) => a + measure(b), 0) + 1;
    case 'comparison': return 5; // 簡易
    case 'definition': return measure(fields.desc) + 1;
    default: return 4;
  }
};

const plans = sections.map(sec => {
  const template = chooseTemplate(sec);
  const fields = toFields(template, sec);
  const cr = constraintsByTpl[template] || { maxCharsPerLine: 26, maxLines: 6 };
  const estimatedLines = estimateLines(template, fields);
  const visualScore = Math.max(50, 100 - Math.max(0, estimatedLines - cr.maxLines) * 10);
  return {
    sectionId: sec.id,
    template,
    fields,
    constraintsResult: {
      estimatedLines,
      maxLines: cr.maxLines,
      maxCharsPerLine: cr.maxCharsPerLine,
      visualScore
    },
    notes: estimatedLines > cr.maxLines ? '文字が多いかも。短文化/分割を検討' : 'OK'
  };
});

writeJSON(outPath, { slides: plans });
console.log(`Planned ${plans.length} slides -> ${outPath}`);

import { readText } from './utils.js';
import fs from 'fs';

const [,, planPath, schemaPath, outputPath] = process.argv;
if (!planPath || !schemaPath || !outputPath) {
  console.error('Usage: node src/05_tune.js <slides_plan.json> <schema.json> <output.json>');
  process.exit(1);
}

const planData = JSON.parse(readText(planPath));
const plans = planData.slides;
let ok = 0, warn = 0;
const tuneResults = [];

for (const p of plans) {
  let issues = [];
  let status = 'OK';

  if (p.template === 'bullets') {
    const n = (p.fields.items || []).length;
    if (n < 3) {
      issues.push(`bullets 項目${n} (<3)`);
      status = 'WARN';
    }
  }
  if (p.constraintsResult && p.constraintsResult.estimatedLines > p.constraintsResult.maxLines) {
    issues.push(`行数超過 est=${p.constraintsResult.estimatedLines} > max=${p.constraintsResult.maxLines}`);
    status = 'WARN';
  }

  tuneResults.push({
    sectionId: p.sectionId,
    template: p.template,
    status: status,
    issues: issues,
    constraints: p.constraintsResult
  });

  if (issues.length) {
    warn++;
    console.log(`[WARN] ${p.sectionId} ${p.template}: ${issues.join(' / ')}`);
  } else {
    ok++;
  }
}

console.log(`OK ${ok}, WARN ${warn}`);

// チューニング結果を出力
const output = {
  summary: {
    total: plans.length,
    ok: ok,
    warn: warn
  },
  tuneResults: tuneResults,
  slidesWithTuning: planData.slides
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
console.log(`Wrote tuning results -> ${outputPath}`);

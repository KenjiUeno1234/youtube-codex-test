import { readText } from './utils.js';

const [,, planPath, schemaPath] = process.argv;
if (!planPath || !schemaPath) {
  console.error('Usage: node src/05_tune.js output/slides_plan.json config/slide.schema.json');
  process.exit(1);
}

const plans = JSON.parse(readText(planPath)).slides;
let ok = 0, warn = 0;
for (const p of plans) {
  let issues = [];
  if (p.template === 'bullets') {
    const n = (p.fields.items || []).length;
    if (n < 3) issues.push(`bullets 項目${n} (<3)`);
  }
  if (p.constraintsResult && p.constraintsResult.estimatedLines > p.constraintsResult.maxLines) {
    issues.push(`行数超過 est=${p.constraintsResult.estimatedLines} > max=${p.constraintsResult.maxLines}`);
  }
  if (issues.length) {
    warn++;
    console.log(`[WARN] ${p.sectionId} ${p.template}: ${issues.join(' / ')}`);
  } else {
    ok++;
  }
}
console.log(`OK ${ok}, WARN ${warn}`);

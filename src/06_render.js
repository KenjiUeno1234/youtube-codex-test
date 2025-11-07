import fs from 'fs';
import path from 'path';
import { readText, writeText } from './utils.js';

const [,, planPath, outDir, themePath] = process.argv;
if (!planPath || !outDir) {
  console.error('Usage: node src/06_render.js output/slides_plan.json output/slides_src [config/theme.css]');
  process.exit(1);
}

const { slides } = JSON.parse(readText(planPath));

const header = `---\nmarp: true\npaginate: true\n---\n\n`;

const esc = (s='') => s.replace(/\|/g, '\\|');

const tpl = {
  title_card: (f) => `# ${f.title || ''}\n\n**${f.subtitle || ''}**\n`,
  definition: (f) => `## ${f.term || ''}\n\n${f.desc || ''}\n`,
  bullets: (f) => `## ${f.title || ''}\n\n${(f.items||[]).map(i => `- ${i}`).join('\n')}\n`,
  process: (f) => `## ${f.title || ''}\n\n${(f.steps||[]).map((s,i)=>`${i+1}. ${s}`).join('\n')}\n`,
  comparison: (f) => `## ${f.title || ''}\n\n| 項目 | 左 | 右 |\n|---|---|---|\n${(f.criteria||[]).map((c,i)=>`| ${esc(c)} | ${esc(f.left?.[i]||'')} | ${esc(f.right?.[i]||'')} |`).join('\n')}\n`,
  recap: (f) => `## まとめ\n\n${(f.points||[]).map(p=>`- ${p}`).join('\n')}\n`,
  cta: (f) => `## 最後に\n\n${f.message||''}\n\n${f.link?`[リンク](${f.link})`:''}\n`,
  diagram: (f) => `## 図解\n\n(ここにSVGを挿入:MVPではプレースホルダー)\n`,
  illustration: (f) => `## イラスト\n\n(ここに画像を挿入:MVPではプレースホルダー)\n`
};

let body = '';
for (const p of slides) {
  const fn = tpl[p.template] || ((f)=>`## ${f.title||''}\n\n${f.body||''}\n`);
  body += `\n---\n\n` + fn(p.fields);
}

const deck = header + body.trim() + '\n';
fs.mkdirSync(outDir, { recursive: true });
writeText(path.join(outDir, 'deck.md'), deck);
console.log(`Wrote ${path.join(outDir, 'deck.md')}`);

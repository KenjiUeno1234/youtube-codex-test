import fs from 'fs';
import path from 'path';
import { readText, writeText } from './utils.js';

const [,, planPath, outDir, themePath] = process.argv;
if (!planPath || !outDir) {
  console.error('Usage: node src/06_render.js output/slides_plan.json output/slides_src [config/theme.css]');
  process.exit(1);
}

const planData = JSON.parse(readText(planPath));
// slidesWithTuning (from tune.js) or slides (from plan.js) を読み取る
const slides = planData.slidesWithTuning || planData.slides;

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
  illustration: (f) => `## イラスト\n\n(ここに画像を挿入:MVPではプレースホルダー)\n`,

  // PDFテンプレート対応（slide_templates_from_image.pdf）
  strong_title: (f) => `\n<!-- _class: strong-title -->\n\n# ${f.title || f.message || ''}\n`,
  list_toc: (f) => `## ${f.title || ''}\n\n${(f.items||[]).map(i => `- ${i}`).join('\n')}\n`,
  illustrations: (f) => `## ${f.title || ''}\n\n![](${f.image_path || 'placeholder.png'})\n\n_${f.caption || 'ここにイラスト/サムネイル画像'}_\n`,
  screenshots: (f) => {
    const img1 = f.screenshot1 || 'placeholder1.png';
    const img2 = f.screenshot2 || 'placeholder2.png';
    return `## ${f.title || ''}\n\n<div style="display: flex; gap: 20px;">\n\n![](${img1})\n\n![](${img2})\n\n</div>\n`;
  }
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

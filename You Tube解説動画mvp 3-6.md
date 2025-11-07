# YouTube解説動画 MVP（3〜6）

最小構成で「台本 → セクションJSON → スライド設計 → MD生成 →（任意でMarp PDF）」まで通すローカル実行用テンプレです。

```
├─ package.json
├─ input/
│  └─ script_final.md          # あなたの台本をここに
├─ output/
│  ├─ sections.json            # 3. セクション分割の結果
│  ├─ slides_plan.json         # 4. 設計結果
│  ├─ slides_src/
│  │  └─ deck.md               # 6. Marp用の1枚デッキ
│  └─ slides_export/
├─ config/
│  ├─ mapping.json             # intent→テンプレ候補
│  ├─ slide.schema.json        # 出力スキーマ（最小）
│  └─ theme.css                # Marp用の簡易テーマ
└─ src/
   ├─ 03_sections.js           # 3. セクション分割
   ├─ 04_plan.js               # 4. スライド設計
   ├─ 05_tune.js               # 5. 簡易評価（MVP）
   ├─ 06_render.js             # 6. MD生成（Marp想定）
   └─ utils.js                 # 共有ユーティリティ
```

---

## package.json
```json
{
  "name": "yt-mvp",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "sections": "node src/03_sections.js input/script_final.md output/sections.json",
    "plan": "node src/04_plan.js output/sections.json config/mapping.json config/slide.schema.json output/slides_plan.json",
    "render:md": "node src/06_render.js output/slides_plan.json output/slides_src config/theme.css",
    "render:pdf": "npx marp output/slides_src/deck.md -o output/slides_export/deck.pdf --allow-local-files --theme-set config/theme.css",
    "tune": "node src/05_tune.js output/slides_plan.json config/slide.schema.json",
    "build": "npm run sections && npm run plan && npm run render:md",
    "build:pdf": "npm run build && npm run render:pdf"
  },
  "devDependencies": {}
}
```

---

## config/mapping.json（intent→候補テンプレ）
```json
{
  "intro": ["title_card", "definition"],
  "point": ["definition", "bullets"],
  "example": ["bullets", "illustration"],
  "comparison": ["comparison", "bullets"],
  "process": ["process", "diagram"],
  "recap": ["recap", "bullets"],
  "cta": ["cta"]
}
```

---

## config/slide.schema.json（最小スキーマ）
```json
{
  "title": "SlidePlanItem",
  "type": "object",
  "properties": {
    "sectionId": { "type": "string" },
    "template": { "enum": [
      "title_card", "definition", "bullets", "comparison",
      "process", "diagram", "illustration", "quote", "recap", "cta"
    ] },
    "fields": { "type": "object" },
    "constraintsResult": {
      "type": "object",
      "properties": {
        "estimatedLines": { "type": "integer" },
        "maxLines": { "type": "integer" },
        "maxCharsPerLine": { "type": "integer" },
        "visualScore": { "type": "integer" }
      }
    },
    "notes": { "type": "string" }
  },
  "required": ["sectionId", "template", "fields"]
}
```

---

## config/theme.css（Marpの簡易テーマ）
```css
/* Minimal JP-friendly theme */
section {
  font-family: 'Noto Sans JP', 'BIZ UDP Gothic', system-ui, -apple-system, sans-serif;
  font-size: 36px;
  line-height: 1.3;
  padding: 6% 7%;
}
h1, h2, h3 { font-weight: 700; }
h1 { font-size: 64px; margin-bottom: 0.6em; }
h2 { font-size: 48px; margin-bottom: 0.4em; }
ul { margin: 0.6em 0; }
li { margin: 0.25em 0; }
.table { font-size: 32px; }
blockquote { border-left: 8px solid #999; padding-left: 16px; color: #333; }
```

---

## src/utils.js
```js
import fs from 'fs';
import path from 'path';

export const readText = (p) => fs.readFileSync(p, 'utf8');
export const writeJSON = (p, obj) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
};
export const writeText = (p, txt) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, txt, 'utf8');
};
export const slug = (s) => s.trim().replace(/\s+/g, '-').slice(0, 50);
export const trim = (s) => s.replace(/[\t ]+/g, ' ').trim();
export const splitSentencesJa = (text) => {
  const cleaned = text.replace(/\r/g, '').replace(/[“”]/g, '"');
  const parts = cleaned.split(/(?<=[。！？!\?])/);
  return parts.map(v => v.trim()).filter(Boolean);
};
export const summarizeJa = (text, n = 30) => {
  const t = trim(text);
  return t.length <= n ? t : t.slice(0, n) + '…';
};
export const detectIntent = (txt) => {
  if (/まとめ|結論|要点/.test(txt)) return 'recap';
  if (/注意|ポイント|コツ|留意/.test(txt)) return 'point';
  if (/例|事例|ケース|例えば/.test(txt)) return 'example';
  if (/比較|対比|vs|ＶＳ/i.test(txt)) return 'comparison';
  if (/手順|方法|ステップ|やり方/.test(txt)) return 'process';
  if (/導入|はじめに|イントロ|概要/.test(txt)) return 'intro';
  if (/登録|行動|CTA|チャンネル/.test(txt)) return 'cta';
  return 'point';
};
```

---

## src/03_sections.js（台本→sections.json）
```js
import fs from 'fs';
import path from 'path';
import { readText, writeJSON, splitSentencesJa, summarizeJa, detectIntent, trim } from './utils.js';

const [,, inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('Usage: node src/03_sections.js input/script_final.md output/sections.json');
  process.exit(1);
}

const md = readText(inPath);
const lines = md.split(/\n/).map(l => l.replace(/\r$/, ''));

let sections = [];
let cur = { title: '', body: [] };

const flush = () => {
  const text = trim(cur.body.join('\n'));
  if (!text) return;
  const sentences = splitSentencesJa(text);
  const first = cur.title || sentences[0] || '';
  sections.push({
    id: 'S' + String(sections.length + 1).padStart(3, '0'),
    summary: summarizeJa(first, 30),
    intent: detectIntent(cur.title + ' ' + text),
    lines: sentences.filter(Boolean).map(s => trim(s))
  });
  cur = { title: '', body: [] };
};

for (const l of lines) {
  if (/^##\s+/.test(l)) { // セクション見出し
    flush();
    cur.title = l.replace(/^##\s+/, '').trim();
    continue;
  }
  if (/^---\s*$/.test(l)) { // 明示区切り
    flush();
    continue;
  }
  cur.body.push(l);
}
flush();

writeJSON(outPath, { sections });
console.log(`Wrote ${sections.length} sections -> ${outPath}`);
```

---

## src/04_plan.js（sections.json→slides_plan.json）
```js
import fs from 'fs';
import { readText, writeJSON, trim } from './utils.js';

const [,, sectionsPath, mappingPath, schemaPath, outPath] = process.argv;
if (!sectionsPath || !mappingPath || !schemaPath || !outPath) {
  console.error('Usage: node src/04_plan.js output/sections.json config/mapping.json config/slide.schema.json output/slides_plan.json');
  process.exit(1);
}

const sections = JSON.parse(readText(sectionsPath)).sections;
const mapping = JSON.parse(readText(mappingPath));

// 簡易テンプレ制約（MVP）
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
```

---

## src/05_tune.js（MVP評価：単純な静的チェック）
```js
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
```

---

## src/06_render.js（slides_plan.json→Marp用 deck.md）
```js
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
  diagram: (f) => `## 図解\n\n(ここにSVGを挿入：MVPではプレースホルダー)\n`,
  illustration: (f) => `## イラスト\n\n(ここに画像を挿入：MVPではプレースホルダー)\n`
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
```

---

## input/script_final.md（ダミー例）
```md
## 導入
この動画では、AIとプログラミングで解説動画を自動化する方法を紹介します。ポイントはテンプレと制約、そして最小限の手直しです。

---
## 手順の全体像
台本をセクションに分割し、メタ情報を付けます。次に意図に応じてテンプレを選び、Markdownに変換します。最後にMarpでPDF化します。

---
## まとめ
工程を分けて自動化すると、品質と再現性が安定します。
```

---

# 使い方（ローカル）
1. Node.js 18+ を用意。
2. `input/script_final.md` に台本を貼り付け。
3. コマンド実行：

```bash
npm run build           # 3→4→6 を連続実行（MD出力）
npm run tune            # 簡易評価（項目不足や行数過多を警告）
# 任意：MarpでPDF化（npxがMarp-CLIを都度取得）
npm run render:pdf
```

> Marp-CLIを常用する場合は `npm i -D @marp-team/marp-cli` を追加してください。

---

## 補足（MVPの割り切り）
- 5. プロンプト自動チューニングは**静的ルール評価のみ**を同梱（`src/05_tune.js`）。
  - LLM連携は後付け可能（`sections.json`/`slides_plan.json` I/Oを固定）。
- `diagram`/`illustration` はプレースホルダー。まずは**テキスト系テンプレ**で動かす想定。
- 日本語組版（禁則等）は最小実装。必要なら `04_plan.js` に短文化ロジックを追加して強化。

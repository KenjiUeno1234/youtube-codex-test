import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { readText, writeJSON, trim } from './utils.js';

const [,, sectionsPath, mappingPath, schemaPath, outPath] = process.argv;
if (!sectionsPath || !mappingPath || !schemaPath || !outPath) {
  console.error('Usage: node src/04_plan.js output/sections.json config/mapping.json config/slide.schema.json output/slides_plan.json');
  process.exit(1);
}

const sections = JSON.parse(readText(sectionsPath)).sections;
const mapping = JSON.parse(readText(mappingPath));

// LLM初期化（環境変数がない場合はnull）
const apiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

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
  cta: { maxCharsPerLine: 24, maxLines: 4 },

  // PDFテンプレート対応（slide_templates_from_image.pdf準拠）
  strong_title: { maxCharsPerLine: 20, maxLines: 2 },
  list_toc: { maxCharsPerLine: 26, maxLines: 6, maxBullets: 5 },
  illustrations: { maxCharsPerLine: 26, maxLines: 3 },
  screenshots: { maxCharsPerLine: 26, maxLines: 3 }
};

const chooseTemplate = (sec) => {
  const cands = mapping[sec.intent] || mapping.point || ['bullets'];

  // ヒューリスティック（PDFテンプレート優先）
  if (sec.intent === 'comparison') return 'comparison';
  if (sec.intent === 'process') return 'process';

  // 目次っぽいセクション → list_toc
  if (sec.summary.includes('目次') && cands.includes('list_toc')) return 'list_toc';

  // ポイント/まとめ系 → list_toc優先
  if ((sec.intent === 'point' || sec.intent === 'recap') && cands.includes('list_toc')) {
    return 'list_toc';
  }

  // 短い強調メッセージ → strong_title
  if (sec.lines.length <= 2 && cands.includes('strong_title')) return 'strong_title';

  // 定義
  if (sec.lines.length <= 2 && cands.includes('definition')) return 'definition';

  // デフォルト
  if (cands.includes('bullets')) return 'bullets';
  return cands[0] || 'title_card';
};

const cut = (s, n) => (s.length <= n ? s : s.slice(0, n) + '…');

// LLMで要点抽出
async function extractKeyPoints(sec, tpl, constraints) {
  if (!anthropic) {
    // フォールバック：従来の方法
    return fallbackExtraction(sec, tpl);
  }

  const text = sec.lines.join('\n');
  const maxChars = constraints.maxCharsPerLine || 26;
  const maxItems = constraints.maxBullets || constraints.maxSteps || 5;

  let prompt = '';

  if (tpl === 'bullets') {
    prompt = `以下のテキストから、スライドの箇条書きに適した要点を抽出してください。

【制約】
- 1項目あたり最大${maxChars}文字
- 最大${maxItems}項目
- 簡潔で分かりやすく
- 重要なポイントだけを抽出
- 文末は体言止めか「です」「ます」で統一

【テキスト】
${text}

【出力形式】
JSON形式で出力してください：
{
  "title": "スライドタイトル（最大30文字）",
  "items": ["項目1", "項目2", ...]
}`;
  } else if (tpl === 'list_toc') {
    prompt = `以下のテキストから、目次または箇条書きリストに適した要点を抽出してください。

【制約】
- 1項目あたり最大${maxChars}文字
- 最大${maxItems}項目
- 簡潔で分かりやすく
- 重要なポイントだけを抽出

【テキスト】
${text}

【出力形式】
JSON形式で出力してください：
{
  "title": "スライドタイトル（最大30文字）",
  "items": ["項目1", "項目2", ...]
}`;
  } else if (tpl === 'title_card') {
    prompt = `以下のテキストから、タイトルスライドに適した内容を抽出してください。

【制約】
- タイトル：最大30文字
- サブタイトル：最大40文字
- 簡潔で印象的に

【テキスト】
${text}

【出力形式】
JSON形式で出力してください：
{
  "title": "タイトル",
  "subtitle": "サブタイトル"
}`;
  } else if (tpl === 'strong_title') {
    prompt = `以下のテキストから、強調メッセージスライドに適したタイトルを抽出してください。

【制約】
- タイトル：最大20文字
- インパクトのある短いメッセージ
- 簡潔で印象的に

【テキスト】
${text}

【出力形式】
JSON形式で出力してください：
{
  "title": "強調タイトル"
}`;
  } else if (tpl === 'recap') {
    prompt = `以下のテキストから、まとめスライドに適した要点を抽出してください。

【制約】
- 1項目あたり最大${maxChars}文字
- 最大${maxItems}項目
- 全体の要点を簡潔に

【テキスト】
${text}

【出力形式】
JSON形式で出力してください：
{
  "title": "まとめ",
  "points": ["要点1", "要点2", ...]
}`;
  } else if (tpl === 'process') {
    prompt = `以下のテキストから、プロセス・手順スライドに適したステップを抽出してください。

【制約】
- 1ステップあたり最大${maxChars}文字
- 最大${maxItems}ステップ
- 手順を明確に
- 簡潔で分かりやすく

【テキスト】
${text}

【出力形式】
JSON形式で出力してください：
{
  "title": "スライドタイトル（最大30文字）",
  "steps": ["ステップ1", "ステップ2", ...]
}`;
  } else if (tpl === 'definition') {
    prompt = `以下のテキストから、定義スライドに適した内容を抽出してください。

【制約】
- 用語：最大16文字
- 説明：最大100文字
- 簡潔で分かりやすく

【テキスト】
${text}

【出力形式】
JSON形式で出力してください：
{
  "term": "用語",
  "desc": "説明"
}`;
  } else if (tpl === 'comparison') {
    prompt = `以下のテキストから、比較スライドに適した内容を抽出してください。

【制約】
- 比較項目：最大3項目
- 各項目の説明は簡潔に

【テキスト】
${text}

【出力形式】
JSON形式で出力してください：
{
  "title": "スライドタイトル（最大30文字）",
  "criteria": ["項目1", "項目2", "項目3"],
  "left": ["左側の説明1", "左側の説明2", "左側の説明3"],
  "right": ["右側の説明1", "右側の説明2", "右側の説明3"]
}`;
  } else if (tpl === 'cta') {
    prompt = `以下のテキストから、行動喚起スライドに適したメッセージを抽出してください。

【制約】
- メッセージ：最大40文字
- 印象的で行動を促す内容

【テキスト】
${text}

【出力形式】
JSON形式で出力してください：
{
  "message": "メッセージ",
  "link": "リンクURL（あれば）"
}`;
  } else if (tpl === 'illustrations' || tpl === 'screenshots') {
    prompt = `以下のテキストから、画像付きスライドに適したタイトルを抽出してください。

【制約】
- タイトル：最大30文字
- 簡潔で分かりやすく

【テキスト】
${text}

【出力形式】
JSON形式で出力してください：
{
  "title": "スライドタイトル"
}`;
  } else {
    return fallbackExtraction(sec, tpl);
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;
    // JSONを抽出（```json...```の場合も対応）
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      console.log(`  ✓ LLMで要点抽出: ${sec.id}`);
      return result;
    } else {
      console.log(`  ⚠ JSON解析失敗、フォールバック: ${sec.id}`);
      return fallbackExtraction(sec, tpl);
    }
  } catch (error) {
    console.error(`  ✗ LLMエラー、フォールバック: ${sec.id}`, error.message);
    return fallbackExtraction(sec, tpl);
  }
}

// フォールバック：従来の方法
function fallbackExtraction(sec, tpl) {
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

    // PDFテンプレート対応
    case 'strong_title':
      return { title: sec.summary || cut(text, 30) };
    case 'list_toc': {
      const items = sec.lines.slice(0, 5).map(v => cut(v, 30));
      return { title: sec.summary, items };
    }
    case 'illustrations':
      return { title: sec.summary, image_path: 'placeholder.png', caption: 'ここにイラスト/サムネイル画像' };
    case 'screenshots':
      return { title: sec.summary, screenshot1: 'placeholder1.png', screenshot2: 'placeholder2.png' };

    default:
      return { title: sec.summary, body: cut(text, 100) };
  }
}

const toFields = async (tpl, sec) => {
  const constraints = constraintsByTpl[tpl] || {};

  // LLMが利用可能な場合はすべてのテンプレートでLLM要約を使用
  // diagram と illustration は画像プレースホルダーのみなのでフォールバック
  const llmSupportedTemplates = [
    'bullets', 'list_toc', 'title_card', 'strong_title', 'recap',
    'process', 'definition', 'comparison', 'cta', 'illustrations', 'screenshots'
  ];

  if (llmSupportedTemplates.includes(tpl) && anthropic) {
    return await extractKeyPoints(sec, tpl, constraints);
  } else {
    return fallbackExtraction(sec, tpl);
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
    case 'recap': return (fields.points || []).reduce((a, b) => a + measure(b), 0) + 1;

    // PDFテンプレート対応
    case 'strong_title': return measure(fields.title || '') || 1;
    case 'list_toc': return (fields.items || []).reduce((a, b) => a + measure(b), 0) + 1;
    case 'illustrations': return 2; // タイトル + 画像
    case 'screenshots': return 2; // タイトル + 画像2枚

    default: return 4;
  }
};

// メイン処理
(async () => {
  console.log(`LLMモード: ${anthropic ? '有効（ANTHROPIC_API_KEY設定済み）' : '無効（フォールバック）'}\n`);

  const plans = [];
  for (const sec of sections) {
    const template = chooseTemplate(sec);
    const fields = await toFields(template, sec);
    const cr = constraintsByTpl[template] || { maxCharsPerLine: 26, maxLines: 6 };
    const estimatedLines = estimateLines(template, fields);
    const visualScore = Math.max(50, 100 - Math.max(0, estimatedLines - cr.maxLines) * 10);

    plans.push({
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
    });
  }

  writeJSON(outPath, { slides: plans });
  console.log(`\nPlanned ${plans.length} slides -> ${outPath}`);
})();

#!/usr/bin/env node
/**
 * 07_html_to_marp.js
 * 03_slides_tuned.jsonからMarp形式のMarkdownを生成
 * HTMLと同じ内容をMarkdown形式で出力
 */

import fs from 'fs';
import path from 'path';

/**
 * Marp形式のMarkdownを生成
 * @param {Object} tunedData - 03_slides_tuned.jsonのデータ
 * @returns {string} Marp形式のMarkdown
 */
function generateMarpMarkdown(tunedData) {
  const slides = tunedData.slidesWithTuning || [];

  // Marpフロントマター（ダークテーマ使用）
  let markdown = `---
marp: true
theme: yt-mvp-dark
paginate: true
---

`;

  // 各スライドを変換
  slides.forEach((slide, index) => {
    const { template, fields } = slide;

    // スライド区切り（最初のスライド以外）
    if (index > 0) {
      markdown += '\n---\n\n';
    }

    // テンプレートに応じた変換
    switch (template) {
      case 'list_toc':
        // 見出しを太字の大きなテキストとして表示（Marpのh2が見えない問題を回避）
        markdown += `# ${fields.title}\n\n`;
        if (fields.items && Array.isArray(fields.items)) {
          fields.items.forEach(item => {
            markdown += `- ${item}\n`;
          });
        }
        break;

      case 'bullets':
        // 見出しを太字の大きなテキストとして表示
        markdown += `# ${fields.title}\n\n`;
        if (fields.items && Array.isArray(fields.items)) {
          fields.items.forEach(item => {
            markdown += `- ${item}\n`;
          });
        }
        break;

      case 'process':
        markdown += `# ${fields.title}\n\n`;
        if (fields.steps && Array.isArray(fields.steps)) {
          fields.steps.forEach((step, i) => {
            markdown += `${i + 1}. ${step}\n`;
          });
        }
        break;

      case 'title_card':
      case 'strong_title':
        markdown += `# ${fields.title}\n\n`;
        if (fields.subtitle) {
          markdown += `${fields.subtitle}\n`;
        }
        break;

      case 'definition':
        markdown += `# ${fields.title}\n\n`;
        if (fields.definition) {
          markdown += `${fields.definition}\n`;
        }
        break;

      case 'comparison':
        markdown += `# ${fields.title}\n\n`;
        if (fields.items && Array.isArray(fields.items)) {
          markdown += `| 項目 | 内容 |\n`;
          markdown += `|------|------|\n`;
          fields.items.forEach(item => {
            markdown += `| ${item.label || ''} | ${item.value || ''} |\n`;
          });
        }
        break;

      case 'recap':
        markdown += `# ${fields.title}\n\n`;
        if (fields.items && Array.isArray(fields.items)) {
          fields.items.forEach(item => {
            markdown += `- ${item}\n`;
          });
        }
        break;

      case 'cta':
        markdown += `# ${fields.title}\n\n`;
        if (fields.message) {
          markdown += `${fields.message}\n\n`;
        }
        if (fields.action) {
          markdown += `**${fields.action}**\n`;
        }
        break;

      default:
        // デフォルト: タイトルと箇条書き
        markdown += `# ${fields.title}\n\n`;
        if (fields.items && Array.isArray(fields.items)) {
          fields.items.forEach(item => {
            markdown += `- ${item}\n`;
          });
        }
    }
  });

  return markdown;
}

/**
 * メイン処理
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node 07_html_to_marp.js <input_tuned_json> <output_md>');
    console.error('Example: node 07_html_to_marp.js output/03_slides_tuned.json output/slides_src/deck_from_html.md');
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1];

  // 入力ファイルの読み込み
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const tunedData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

  // Markdownの生成
  const markdown = generateMarpMarkdown(tunedData);

  // 出力ディレクトリの作成
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 出力
  fs.writeFileSync(outputPath, markdown, 'utf-8');
  console.log(`Wrote ${outputPath}`);
}

main();

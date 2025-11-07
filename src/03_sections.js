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

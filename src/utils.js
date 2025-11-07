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
  const cleaned = text.replace(/\r/g, '').replace(/[""]/g, '"');
  const parts = cleaned.split(/(?<=[。! ?!\?])/);
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

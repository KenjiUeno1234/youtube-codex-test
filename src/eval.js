#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { pred: null, gold: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--pred') {
      args.pred = argv[++i];
    } else if (arg === '--gold') {
      args.gold = argv[++i];
    }
  }
  if (!args.pred || !args.gold) {
    console.error('Usage: node src/eval.js --pred <pred.json> --gold <gold.json>');
    process.exit(1);
  }
  return args;
}

function loadSlides(filePath) {
  const absolute = path.resolve(filePath);
  const raw = fs.readFileSync(absolute, 'utf-8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.slides)) {
    throw new Error(`slides array missing in ${filePath}`);
  }
  return data.slides;
}

function evaluate(predSlides, goldSlides) {
  const slideCountDiff = Math.abs(predSlides.length - goldSlides.length);
  const compareLength = Math.min(predSlides.length, goldSlides.length);
  let typeMismatch = 0;
  for (let i = 0; i < compareLength; i++) {
    const predType = predSlides[i] && predSlides[i].type;
    const goldType = goldSlides[i] && goldSlides[i].type;
    if (predType !== goldType) {
      typeMismatch += 1;
    }
  }

  let itemsLengthPenalty = 0;
  for (const slide of predSlides) {
    if (slide && slide.type === 'bullets') {
      const items = Array.isArray(slide.items) ? slide.items : [];
      if (items.length < 2 || items.length > 5) {
        itemsLengthPenalty += 1;
      }
    }
  }

  const deductions = slideCountDiff * 5 + typeMismatch * 10 + itemsLengthPenalty * 2;
  const score = Math.max(0, 100 - deductions);

  return {
    slide_count_diff: slideCountDiff,
    type_mismatch: typeMismatch,
    items_length_penalty: itemsLengthPenalty,
    score
  };
}

function main() {
  const { pred, gold } = parseArgs(process.argv);
  try {
    const predSlides = loadSlides(pred);
    const goldSlides = loadSlides(gold);
    const result = evaluate(predSlides, goldSlides);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

main();

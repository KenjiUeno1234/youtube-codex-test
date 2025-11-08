#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function escapePdfString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function slideTextToLines(slide) {
  return slide
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^\s*#+\s*/, '')
      .replace(/^\s*[-*+]\s*/, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!?\[[^\]]*\]\([^)]*\)/g, '')
      .trim())
    .filter((line) => line.length > 0);
}

function buildPdf(slides) {
  const objects = [];
  const pageObjectIds = [];

  const fontObjectId = 3 + slides.length * 2;

  slides.forEach((slide, index) => {
    const pageObjectId = 3 + index * 2;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);

    const lines = slideTextToLines(slide);
    const leading = 44;
    const startY = 720;
    const contentLines = ['BT', '/F1 36 Tf', `${leading} TL`, `1 0 0 1 72 ${startY} Tm`];

    lines.forEach((line, lineIndex) => {
      if (lineIndex === 0) {
        contentLines.push(`(${escapePdfString(line)}) Tj`);
      } else {
        contentLines.push('T*');
        contentLines.push(`(${escapePdfString(line)}) Tj`);
      }
    });

    if (lines.length === 0) {
      contentLines.push('( ) Tj');
    }

    contentLines.push('ET');

    const stream = contentLines.join('\n') + '\n';
    const streamLength = Buffer.byteLength(stream, 'utf8');

    const contentObject = `${contentObjectId} 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}endstream`;
    const pageObject = `${pageObjectId} 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`;

    objects.push({ id: contentObjectId, content: contentObject });
    objects.push({ id: pageObjectId, content: pageObject });
  });

  const pagesKids = pageObjectIds.map((id) => `${id} 0 R`).join(' ');
  const pagesObject = `2 0 obj\n<< /Type /Pages /Kids [ ${pagesKids} ] /Count ${slides.length} /MediaBox [0 0 1080 810] >>`;
  const catalogObject = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>';
  const fontObject = `${fontObjectId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  objects.push({ id: 1, content: catalogObject });
  objects.push({ id: 2, content: pagesObject });
  objects.push({ id: fontObjectId, content: fontObject });

  objects.sort((a, b) => a.id - b.id);

  let pdf = '%PDF-1.4\n';
  const xref = [];
  const totalObjects = fontObjectId;

  pdf += ''; // ensure string start
  xref[0] = '0000000000 65535 f \n';

  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];
    while (xref.length < object.id) {
      xref.push('0000000000 65535 f \n');
    }
    const offset = Buffer.byteLength(pdf, 'utf8');
    xref[object.id] = offset.toString().padStart(10, '0') + ' 00000 n \n';
    pdf += `${object.id} 0 obj\n${object.content}\nendobj\n`;
  }

  const startxref = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${totalObjects + 1}\n`;
  for (let i = 0; i <= totalObjects; i++) {
    if (!xref[i]) {
      xref[i] = '0000000000 65535 f \n';
    }
    pdf += xref[i];
  }
  pdf += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

function extractSlides(markdown) {
  const frontMatterMatch = markdown.match(/^---\n[\s\S]*?\n---\n/);
  let body = markdown;
  if (frontMatterMatch) {
    body = markdown.slice(frontMatterMatch[0].length);
  }
  return body
    .split(/\n-{3,}\n/)
    .map((slide) => slide.trim())
    .filter((slide) => slide.length > 0);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: marp <input.md> --pdf -o <output.pdf>');
    process.exit(1);
  }

  const inputPath = args[0];
  if (!inputPath) {
    console.error('Input markdown file is required.');
    process.exit(1);
  }

  let outputPath = null;
  for (let i = 1; i < args.length; i++) {
    if ((args[i] === '-o' || args[i] === '--output') && args[i + 1]) {
      outputPath = args[i + 1];
    }
  }

  if (!outputPath) {
    outputPath = path.join(process.cwd(), 'out.pdf');
  }

  const markdown = fs.readFileSync(inputPath, 'utf-8');
  const slides = extractSlides(markdown);
  const pdfBuffer = buildPdf(slides);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log(`Generated PDF with ${slides.length} slide(s) at ${outputPath}`);
}

main();

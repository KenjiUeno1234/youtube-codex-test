const fs = require('fs');
const path = require('path');

const sectionsPath = path.join(__dirname, '..', 'data', 'sections.json');
const slidesOutputPath = path.join(__dirname, '..', 'data', 'slides.json');

const IMAGE_KEYWORDS = /(図|イラスト|スクショ|スクリーンショット|画像|image|photo|picture|diagram)/i;
const IMAGE_PLACEHOLDER = 'data/assets/placeholder.png';

function chunkLines(lines, size) {
  const chunks = [];
  for (let i = 0; i < lines.length; i += size) {
    chunks.push(lines.slice(i, i + size));
  }
  return chunks;
}

function ensureTitle(section, index) {
  return section.title && section.title.trim().length > 0
    ? section.title.trim()
    : `Section ${index + 1}`;
}

function makeSubtitle(lines) {
  if (!lines.length) return '';
  const selected = lines.slice(0, 2).join(' ');
  return selected.length > 140 ? `${selected.slice(0, 137)}...` : selected;
}

function buildSlides(sections) {
  const slides = [];

  sections.forEach((section, index) => {
    const title = ensureTitle(section, index);
    const body = Array.isArray(section.body) ? section.body : [];
    let workingLines = [...body];

    if (index === 0) {
      const subtitle = makeSubtitle(workingLines);
      slides.push({
        type: 'title',
        title,
        subtitle,
      });
      workingLines = workingLines.slice(Math.min(workingLines.length, 2));
    }

    const bulletChunks = chunkLines(workingLines, 5);
    bulletChunks.forEach((chunk) => {
      if (chunk.length === 0) {
        return;
      }
      slides.push({
        type: 'bullets',
        title,
        items: chunk,
      });
    });

    const imageLine = body.find((line) => IMAGE_KEYWORDS.test(line));
    if (imageLine) {
      slides.push({
        type: 'image',
        title,
        path: IMAGE_PLACEHOLDER,
        caption: imageLine.trim(),
      });
    }
  });

  return slides;
}

function main() {
  if (!fs.existsSync(sectionsPath)) {
    console.error('sections.json not found. Please run splitSections first.');
    process.exit(1);
  }

  const sectionsData = JSON.parse(fs.readFileSync(sectionsPath, 'utf-8'));
  const sections = sectionsData.sections || [];
  if (!Array.isArray(sections) || sections.length === 0) {
    console.error('No sections found to plan slides.');
    process.exit(1);
  }

  const slides = buildSlides(sections);
  fs.writeFileSync(slidesOutputPath, JSON.stringify({ slides }, null, 2));
  console.log(`Planned ${slides.length} slide(s) to ${slidesOutputPath}`);
}

main();

const fs = require('fs');
const path = require('path');

const slidesPath = path.join(__dirname, '..', 'data', 'slides.json');
const outputPath = path.join(__dirname, '..', 'out', 'slides.md');
const templatesDir = path.join(__dirname, 'templates');
const assetsDir = path.join(__dirname, '..', 'data', 'assets');

const MAX_BULLET_LINES = 5;
const MAX_LINE_LENGTH = 40;
const EMPHASIS_KEYWORDS = ['重要', 'ポイント', 'まとめ'];
const NUMBER_PATTERN = /\d+(?:\.\d+)?%?/;
const PLACEHOLDER_IMAGE = 'placeholder.png';
const PLACEHOLDER_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQI12NgYGAAAAAEAAFPAmEEAAAAAElFTkSuQmCC';

function loadTemplate(name) {
  const templatePath = path.join(templatesDir, `${name}.md`);
  return fs.readFileSync(templatePath, 'utf-8');
}

function applyTemplate(template, replacements) {
  return template.replace(/{{(\w+)}}/g, (_, key) => replacements[key] ?? '');
}

function renderTitleSlide(slide, template) {
  return applyTemplate(template, {
    title: slide.title || '',
    subtitle: slide.subtitle || '',
  });
}

function formatBulletItem(item) {
  if (!item || typeof item !== 'string') {
    return '- ';
  }

  let text = item.trim();
  if (text.length === 0) {
    return '- ';
  }

  if (EMPHASIS_KEYWORDS.some((keyword) => text.includes(keyword))) {
    if (!text.startsWith('✅')) {
      text = `✅ ${text}`;
    }
  }

  if (NUMBER_PATTERN.test(text)) {
    text = `${text} ← 数値`;
  }

  const chars = Array.from(text);
  if (chars.length <= MAX_LINE_LENGTH) {
    return `- ${text}`;
  }

  const lines = [];
  for (let i = 0; i < chars.length; i += MAX_LINE_LENGTH) {
    lines.push(chars.slice(i, i + MAX_LINE_LENGTH).join(''));
  }

  return `- ${lines[0]}${
    lines
      .slice(1)
      .map((line) => `\n  ${line}`)
      .join('')
  }`;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function renderBulletsSlides(slide, template) {
  const items = Array.isArray(slide.items) ? slide.items : [];
  const formattedItems = items.map(formatBulletItem);
  const chunks = chunkArray(formattedItems, MAX_BULLET_LINES);
  const effectiveChunks = chunks.length > 0 ? chunks : [[formatBulletItem('')]];

  return effectiveChunks.map((chunk) => {
    const itemsBlock = chunk.join('\n');
    return applyTemplate(template, {
      title: slide.title || '',
      items: itemsBlock,
    });
  });
}

function resolveImagePath(slidePath) {
  ensurePlaceholderImage();
  if (slidePath) {
    const absolute = path.isAbsolute(slidePath)
      ? slidePath
      : path.join(__dirname, '..', slidePath);
    if (fs.existsSync(absolute)) {
      return slidePath;
    }
  }

  const placeholder = path.join('data', 'assets', PLACEHOLDER_IMAGE);
  const absolutePlaceholder = path.join(assetsDir, PLACEHOLDER_IMAGE);
  return placeholder;
}

function ensurePlaceholderImage() {
  const placeholderPath = path.join(assetsDir, PLACEHOLDER_IMAGE);
  if (fs.existsSync(placeholderPath)) {
    return;
  }

  fs.mkdirSync(assetsDir, { recursive: true });
  const buffer = Buffer.from(PLACEHOLDER_BASE64, 'base64');
  fs.writeFileSync(placeholderPath, buffer);
}

function renderImageSlide(slide, template) {
  const resolvedPath = resolveImagePath(slide.path);
  return applyTemplate(template, {
    title: slide.title || '',
    path: resolvedPath,
    caption: slide.caption || '',
  });
}

function renderSlides(slides) {
  const titleTemplate = loadTemplate('title');
  const bulletsTemplate = loadTemplate('bullets');
  const imageTemplate = loadTemplate('image');

  const rendered = [];

  slides.forEach((slide) => {
    switch (slide.type) {
      case 'title':
        rendered.push(renderTitleSlide(slide, titleTemplate));
        break;
      case 'image':
        rendered.push(renderImageSlide(slide, imageTemplate));
        break;
      case 'bullets':
      default:
        rendered.push(...renderBulletsSlides(slide, bulletsTemplate));
        break;
    }
  });

  return rendered;
}

function main() {
  if (!fs.existsSync(slidesPath)) {
    console.error('slides.json not found. Please run planSlides first.');
    process.exit(1);
  }

  const slidesData = JSON.parse(fs.readFileSync(slidesPath, 'utf-8'));
  const slides = slidesData.slides || [];
  if (!Array.isArray(slides) || slides.length === 0) {
    console.error('No slides to render.');
    process.exit(1);
  }

  const renderedSlides = renderSlides(slides);
  const header = `---\nmarp: true\npaginate: true\nstyle: |\n  section { font-size: 36px; }\n  h1,h2 { font-size: 48px; }\n---`;
  const document = `${header}\n\n${renderedSlides.join('\n\n---\n\n')}`;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, document);
  console.log(`Rendered slides markdown to ${outputPath}`);
}

main();

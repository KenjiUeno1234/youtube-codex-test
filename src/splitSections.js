const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, '..', 'data', 'script.md');
const outputPath = path.join(__dirname, '..', 'data', 'sections.json');

function sanitizeTitle(text) {
  return text ? text.replace(/^#+\s*/, '').trim() : '';
}

function createSection(title, lines) {
  const cleanedLines = lines.map((line) => line.trim()).filter((line) => line.length > 0);
  return {
    title: sanitizeTitle(title) || sanitizeTitle(cleanedLines[0] || ''),
    body: cleanedLines,
  };
}

function splitByHeadings(content) {
  const lines = content.split(/\r?\n/);
  const sections = [];
  let currentTitle = null;
  let currentLines = [];

  lines.forEach((line) => {
    const headingMatch = line.trim().match(/^##\s+(.*)$/);
    if (headingMatch) {
      if (currentTitle !== null) {
        sections.push(createSection(currentTitle, currentLines));
      }
      currentTitle = headingMatch[1].trim();
      currentLines = [];
    } else if (currentTitle !== null) {
      currentLines.push(line);
    }
  });

  if (currentTitle !== null) {
    sections.push(createSection(currentTitle, currentLines));
  }

  return sections;
}

function splitByBlankLines(content) {
  return content
    .split(/\n(?:\s*\n){2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      const lines = block.split(/\r?\n/).map((line) => line.trim());
      const title = sanitizeTitle(lines.find((line) => line.length > 0) || 'Section');
      const body = lines.filter((line) => line.length > 0);
      return { title, body };
    });
}

function main() {
  if (!fs.existsSync(scriptPath)) {
    console.error(`Script file not found at ${scriptPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(scriptPath, 'utf-8');
  const hasHeadings = /^##\s+/m.test(content);
  const sections = hasHeadings ? splitByHeadings(content) : splitByBlankLines(content);

  fs.writeFileSync(outputPath, JSON.stringify({ sections }, null, 2));
  console.log(`Saved ${sections.length} section(s) to ${outputPath}`);
}

main();

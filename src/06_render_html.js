import fs from 'fs';
import path from 'path';
import { readText } from './utils.js';

const [,, planPath, outDir] = process.argv;
if (!planPath || !outDir) {
  console.error('Usage: node src/06_render_html.js output/slides_tuned.json output/slides_export');
  process.exit(1);
}

const planData = JSON.parse(readText(planPath));
const slides = planData.slidesWithTuning || planData.slides;

// テンプレート関数（テンプレート名をdata属性として追加）
const tpl = {
  title_card: (f, templateName) => `
    <div class="slide title-card" data-template="title_card">
      <h1>${f.title || ''}</h1>
      <p class="subtitle">${f.subtitle || ''}</p>
    </div>`,

  definition: (f, templateName) => `
    <div class="slide definition" data-template="definition">
      <h2>${f.term || ''}</h2>
      <p>${f.desc || ''}</p>
    </div>`,

  bullets: (f, templateName) => `
    <div class="slide bullets" data-template="bullets">
      <h2>${f.title || ''}</h2>
      <ul>
        ${(f.items || []).map(i => `<li>${i}</li>`).join('\n        ')}
      </ul>
    </div>`,

  process: (f, templateName) => `
    <div class="slide process" data-template="process">
      <h2>${f.title || ''}</h2>
      <ol>
        ${(f.steps || []).map(s => `<li>${s}</li>`).join('\n        ')}
      </ol>
    </div>`,

  comparison: (f, templateName) => `
    <div class="slide comparison" data-template="comparison">
      <h2>${f.title || ''}</h2>
      <table>
        <thead>
          <tr>
            <th>項目</th>
            <th>左</th>
            <th>右</th>
          </tr>
        </thead>
        <tbody>
          ${(f.criteria || []).map((c, i) => `
          <tr>
            <td>${c}</td>
            <td>${f.left?.[i] || ''}</td>
            <td>${f.right?.[i] || ''}</td>
          </tr>`).join('\n        ')}
        </tbody>
      </table>
    </div>`,

  recap: (f, templateName) => `
    <div class="slide recap" data-template="recap">
      <h2>${f.title || 'まとめ'}</h2>
      <ul>
        ${(f.items || f.points || []).map(p => `<li>${p}</li>`).join('\n        ')}
      </ul>
    </div>`,

  cta: (f, templateName) => `
    <div class="slide cta" data-template="cta">
      <h2>最後に</h2>
      <p class="message">${f.message || ''}</p>
      ${f.link ? `<a href="${f.link}" class="link">リンク</a>` : ''}
    </div>`,

  diagram: (f, templateName) => `
    <div class="slide diagram" data-template="diagram">
      <h2>図解</h2>
      <div class="placeholder">ここにSVGを挿入</div>
    </div>`,

  illustration: (f, templateName) => `
    <div class="slide illustration" data-template="illustration">
      <h2>イラスト</h2>
      <div class="placeholder">ここに画像を挿入</div>
    </div>`,

  // PDFテンプレート対応
  strong_title: (f, templateName) => `
    <div class="slide strong-title" data-template="strong-title">
      <h1>${f.title || f.message || ''}</h1>
    </div>`,

  list_toc: (f, templateName) => `
    <div class="slide list-toc" data-template="list-table-of-contents">
      <h2>${f.title || ''}</h2>
      <ul>
        ${(f.items || []).map(i => `<li>${i}</li>`).join('\n        ')}
      </ul>
    </div>`,

  illustrations: (f, templateName) => `
    <div class="slide illustrations" data-template="illustrations">
      <h2>${f.title || ''}</h2>
      <div class="image-placeholder">
        <p class="caption">${f.caption || 'ここにイラスト/サムネイル画像'}</p>
        ${f.description ? `<p class="description">${f.description.replace(/\n/g, '<br>')}</p>` : ''}
      </div>
    </div>`,

  screenshots: (f, templateName) => {
    const images = f.images || [];
    return `
    <div class="slide screenshots" data-template="screenshots">
      <h2>${f.title || ''}</h2>
      <div class="screenshots-grid">
        ${images.map(img => `
        <div class="screenshot-placeholder">
          <p class="caption">${img.caption || 'ここにスクリーンショット画像'}</p>
          ${img.description ? `<p class="description">${img.description.replace(/\n/g, '<br>')}</p>` : ''}
        </div>`).join('\n        ')}
        ${images.length < 2 ? '<div class="screenshot-placeholder">ここにスクリーンショット画像</div>' : ''}
      </div>
    </div>`;
  }
};

// スライドHTML生成
let slidesHTML = '';
for (const p of slides) {
  const fn = tpl[p.template] || ((f, templateName) => `
    <div class="slide" data-template="${templateName || 'unknown'}">
      <h2>${f.title || ''}</h2>
      <p>${f.body || ''}</p>
    </div>`);
  slidesHTML += fn(p.fields, p.template);
}

// 完全なHTMLドキュメント生成
const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YouTube解説動画スライド</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="slides-container">
    ${slidesHTML}
  </div>

  <script>
    // スライド操作
    let currentSlide = 0;
    const slides = document.querySelectorAll('.slide');

    function showSlide(n) {
      slides.forEach((slide, index) => {
        slide.classList.remove('active');
        if (index === n) {
          slide.classList.add('active');
        }
      });
    }

    function nextSlide() {
      currentSlide = (currentSlide + 1) % slides.length;
      showSlide(currentSlide);
    }

    function prevSlide() {
      currentSlide = (currentSlide - 1 + slides.length) % slides.length;
      showSlide(currentSlide);
    }

    // キーボード操作
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        prevSlide();
      }
    });

    // 初期表示
    showSlide(0);
  </script>
</body>
</html>
`;

// ファイル出力
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'deck.html'), html, 'utf-8');
console.log(`Wrote ${path.join(outDir, 'deck.html')}`);

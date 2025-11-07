MVP、一式をキャンバスに置きました。最短で動かす手順だけここに抜粋します。

台本を入れる
input/script_final.md にあなたの台本を貼り付け。

生成パイプラインを回す（3→4→6）

npm run build      # sections.json → slides_plan.json → slides_src/deck.md
npm run tune       # （任意）簡易チェック：行数過多/箇条書き2個問題など


PDF化したい場合（Marp-CLIをnpxで）

npm run render:pdf   # output/slides_export/deck.pdf を出力


設計ポイント

入出力のI/O形式（sections.json / slides_plan.json）を固定してあるので、あとからLLMや評価器を差し替えやすいです。

まずはテキスト系テンプレ（title/definition/bullets/process/comparison/recap/cta）で通し、図解・イラストは後追い実装に寄せています。
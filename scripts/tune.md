# Slide Mapper Prompt Tuning Guide

この手順書は、`prompts/slide_mapper_v1.md` を起点により高スコアなプロンプトを開発するためのものです。LLMの呼び出しは人手で行い、結果と評価をリポジトリに記録します。

## 前提
- 評価データ: `data/dataset/input_*.md` と `data/dataset/gold_*.json`
- 予測保存先: `preds/` ディレクトリ（存在しない場合は作成）
- レポート保存先: `reports/` ディレクトリ

## サイクル共通フロー
1. `data/dataset/input_*.md` からランダムに3件選ぶ（例: 1,3,5番）。
2. 対応する台本テキストを LLM に入力し、`prompts/slide_mapper_vX.md`（Xはバージョン番号）を適用する。
3. LLMの出力（厳格JSON）を `preds/<version>_<id>.json` に保存する。
4. 各ファイルに対して評価コマンドを実行し、結果を集計する。
   ```bash
   node src/eval.js --pred preds/<version>_<id>.json --gold data/dataset/gold_<id>.json
   ```
5. スコアを `reports/report_vX.md` に追記し、平均スコアを算出する。
6. 失点理由（スライド数過不足、type違反、items数逸脱など）を分析し、次バージョンのプロンプトに改善点を追記する。

## 実施例
- v1: `prompts/slide_mapper_v1.md` を使用し、評価を `reports/report_v1.md` に記録。
- v2: v1の指摘を踏まえて追記した `prompts/slide_mapper_v2.md` を作成し、同様に評価して `reports/report_v2.md` に記録。
- v3: 追加改善版として `prompts/slide_mapper_v3.md` を作成。平均スコアがv2より高いことを確認する。

各サイクル後、平均スコアが向上しているか確認する。最も高い平均スコアを出したプロンプトを `prompts/slide_mapper_best.md` にコピーし、コミットする。

## 役立つスクリプト
単一ファイルの素早い評価には npm script を利用する。
```bash
npm run eval:one
```
デフォルトでは `preds/tmp.json` と `data/dataset/gold_01.json` を比較するため、適宜オプションを直接指定して使い分けること。

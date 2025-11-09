# Prompt Optimizer

このスキルは、`プロンプトファイルへのパス`のプロンプトを`データセットへのパス`内のデータセットに対して100%正確に出力できるように改善します。

## 最適化プロセス

### ステップ1: データセットの選択

- 全データセットから**3セットをランダムに選択**します
- これにより特定のデータセットへの過適合を防ぎます
- 各イテレーションで異なる3セットを選ぶことで、汎用性を高めます

### ステップ2: 現状のプロンプトでの生成と比較

選択した3セットそれぞれに対して：

1. **markdown-to-json-converter subagentを起動**
   - 現状の`slidegenPrompt.ts`を使用してマークダウンからJSONを生成
   - タスクツールで`markdown-to-json-converter`を並列に3つ起動

2. **生成結果と理想出力の比較**
   - 生成されたJSONファイルを読み込む
   - 理想のJSONファイル（データセット）を読み込む
   - 両者を詳細に比較分析

### ステップ3: 差分の分析

`EVALUATION_CRITERIA.md`の評価基準に基づいて、以下を分析：

#### 3.1 スライド範囲の正確性（30%）
- スライド番号（第3階層）が正確に反映されているか
- 同じ番号内のセリフが適切にグループ化されているか
- **差分の例**:
  - 理想: 2枚のスライド / 生成: 3枚のスライド
  - スライド番号「- 1」を無視している

#### 3.2 スライドタイプの適切性（25%）
- 各スライドのタイプが理想と一致しているか
- 不一致の場合、どのような誤判断があったか
- **差分の例**:
  - 理想: `screenshots` / 生成: `recording`
  - 理想: `diagram` / 生成: `illustrations`

#### 3.3 セリフのグループ化品質（15%）
- 複数セリフが適切に1枚にまとめられているか
- 不必要に細分化されていないか

#### 3.4 必須フィールドの完全性（10%）
- すべての必須フィールドが存在するか
- `reference`フィールドがあるか

#### 3.5 コンテンツの簡潔性（10%）
- タイトルや説明が適切に要約されているか
- 5行以内に収まっているか

#### 3.6 list-table-of-contents → list-itemの流れ（5%）
- 対応関係が正しく構築されているか

#### 3.7 strong-messageの使用頻度（3%）
- 過度に使用されていないか（10-15%以下）

#### 3.8 JSON形式の正確性（2%）
- 有効なJSON形式か

### ステップ4: 合致率の計算

```typescript
interface MatchScore {
  totalSlides: number;          // 理想のスライド総数
  matchedSlides: number;        // タイプが一致したスライド数
  matchRate: number;            // 合致率 (matchedSlides / totalSlides)
  detailedScores: {
    slideRangeAccuracy: number;    // スライド範囲の正確性 (0-100)
    slideTypeAppropriate: number;  // タイプの適切性 (0-100)
    groupingQuality: number;       // グループ化品質 (0-100)
    fieldCompleteness: number;     // フィールド完全性 (0-100)
    contentConciseness: number;    // 簡潔性 (0-100)
    listFlowCorrectness: number;   // list構造の正しさ (0-100)
    strongMessageFreq: number;     // strong-message頻度 (0-100)
    jsonValidity: number;          // JSON妥当性 (0-100)
  };
  overallScore: number;         // 総合スコア (重み付け平均)
}
```

**合致率の計算方法**:
- スライド種別が完全一致したスライド数 / 理想のスライド総数
- 例: 理想10枚、一致8枚 → 80%

### ステップ5: プロンプトの改善

分析結果に基づいて`プロンプトファイルへのパス`を改善：

#### 改善パターン

1. **スライド番号の無視問題**
   - プロンプト内の「第3階層の数字」に関する説明を強化
   - Few-shot例を追加

2. **タイプ選択の誤り**
   - 言語的手がかりを追加・修正
   - 判断基準の説明を明確化
   - 誤りが多いタイプのFew-shot例を追加

3. **グループ化の問題**
   - 「1枚のスライドで複数セリフをカバー」の重要性を強調
   - グループ化パターンの説明を追加

4. **list-table-of-contents → list-item の欠落**
   - この流れの必須性を強調
   - 具体例を追加

5. **strong-messageの過度な使用**
   - 使用制限をより明確に記述
   - 「本当に重要なメッセージのみ」を強調

#### 改善の記録

各イテレーションで以下を記録：
```markdown
## イテレーション N

### 選択したデータセット
- dataset1.md
- dataset2.md
- dataset3.md

### 合致率
- dataset1: X%
- dataset2: Y%
- dataset3: Z%
- 平均: W%

### 主な問題点
1. 問題の説明
2. 問題の説明

### 改善内容
1. プロンプトの○○セクションに××を追加
2. Few-shot例を追加：...

### 総合スコア: XX点
```

### ステップ6: 評価基準の更新

プロンプト改善の過程で評価基準の解像度が高まった場合、`EVALUATION_CRITERIA.md`も更新：

- 新たに発見した判断パターンを追加
- より詳細な評価方法を記述
- よくある問題と対策を追加

## 終了条件

以下のいずれかを満たすまで繰り返します：

1. **最大10イテレーション**に達した
2. **合致率が90%を超えた**（3セットの平均）
   - スライド種別の一致を主に評価
   - 中身（タイトル、説明文など）は完全一致でなくても可

## 実行手順

### 準備フェーズ

1. `データセットへのパス`配下のすべてのファイルを確認
2. イテレーション結果を記録するための変数を初期化

### イテレーションループ

```
for iteration in 1..10:
  1. 全データセットから3セットをランダム選択
  2. 各セットに対してmarkdown-to-json-converterを並列実行
  3. 生成結果と理想出力を比較分析
  4. 合致率を計算
  5. if 平均合致率 >= 90%:
       break
  6. プロンプトを改善
  7. 必要に応じてEVALUATION_CRITERIA.mdを更新
```

### 完了フェーズ

1. 最終結果のサマリーを出力
2. 改善されたプロンプトの主な変更点を列挙
3. 各データセットに対する最終的な合致率を表示

## 重要な注意事項

### 過適合の防止

- 毎回異なる3セットを選択することで、特定データセットへの過適合を防ぐ
- 最終的には全データセットで検証することを推奨

### プロンプト改善の方針

- **具体例の追加**: Few-shot例を増やす
- **判断基準の明確化**: 言語的手がかりを追加
- **重要事項の強調**: 「重要」「必ず」などの強調表現を使用
- **構造の改善**: セクションの順序や階層を最適化

### 評価の焦点

- **スライド種別の一致**を最優先
- タイトルや説明文の完全一致は求めない（意味的に同等であればOK）
- スライド数の一致を重視

## 出力形式

最終的に以下の情報を出力：

```markdown
# プロンプト最適化結果

## 実行サマリー
- 実施イテレーション数: X回
- 最終平均合致率: XX%
- 総合スコア: XX点

## イテレーション履歴
[各イテレーションの詳細]

## 最終評価
平均: XX%

## 主な改善点
1. 改善内容の説明
2. 改善内容の説明
...

## 残存する課題
1. 課題の説明
2. 課題の説明
...

## 推奨される次のステップ
1. 提案内容
2. 提案内容
...
```

## 使用ツール

- **Task tool**: markdown-to-json-converter subagentの起動
- **Read tool**: マークダウンファイル、JSONファイルの読み込み
- **Edit tool**: プロンプトファイルの編集
- **Write tool**: 分析結果やログの記録

## 実装のヒント

### JSONの比較方法

```typescript
// スライド種別の比較
const compareSlideTypes = (generated: any[], ideal: any[]) => {
  let matches = 0;
  const minLength = Math.min(generated.length, ideal.length);

  for (let i = 0; i < minLength; i++) {
    if (generated[i].type === ideal[i].type) {
      matches++;
    }
  }

  return {
    matches,
    total: ideal.length,
    rate: matches / ideal.length
  };
};
```

### データセット選択

```typescript
const datasets = [];

const selectRandomDatasets = (count: number) => {
  const shuffled = [...datasets].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};
```
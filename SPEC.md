# 五目並べブラウザアプリ 仕様書

## 1. プロダクト概要
- ブラウザ上で 15×15 の碁盤を用いた五目並べをプレイできる 2 人対戦ゲーム。
- 黒番と白番が交互に石を置き、先に 5 連続のラインを作ったプレイヤーが勝利。
- PC/タブレット/モバイルで操作可能なレスポンシブ UI を採用。
- VRM アバターの吹き出し表示と、音声合成（TTS）によるセリフ読み上げに対応。

## 2. 画面仕様
### 2.1 レイアウト
- ヘッダー: タイトル「五目並べ」。
  - ステータス: 現在の手番 / 勝敗 / 引き分けメッセージ。
  - オプション: 歯車ボタン（⚙）で設定ダイアログを開く。
- 盤面: 15×15 のグリッド。CSS Grid で `button.cell` を 225 個生成。
- サイド: 右側に VRM アバターのビューア。
- フッター: リセット ボタンで対局を初期化。

### 2.2 盤面表示
- セルはクリック可能な `button`。`data-row`/`data-col` 属性で位置を管理。
- 石の描画は `cell.black` / `cell.white` クラスで疑似要素に丸石を表示。
- 勝利ラインには `cell.win` クラスを付与し、アウトラインでハイライト。
- アクセシビリティ: `aria-label` に座標と状態を設定。`:focus-visible` 装飾あり。

### 2.3 オプションダイアログ（⚙）
- 相槌（AIリアクション）
  - 有効/無効、発生確率（%）、クールダウン(ms)、手数間隔、フレーズ一覧。
- AI手番のひとこと
  - 有効/無効、発生確率（%）、クールダウン(ms)、手数間隔、フレーズ一覧。
- 吹き出し（デフォルト設定）
  - 位置プリセット、サイズ、ログ表示の有無、ログ最大件数。
- 音声合成（TTS）
  - 読み上げ ON/OFF。
  - エンジン選択: ブラウザ（Web Speech）/ VOICEVOX（ローカル）。
  - Web Speech: 音声、話速、ピッチ、音量。
  - VOICEVOX: 話者、API ベースURL、速度、ピッチ、抑揚、音量。

## 3. ゲーム仕様
- 盤サイズ: 15×15 固定（`BOARD_SIZE = 15`）。
- 勝利条件: 連続 5 マス（`WIN_LENGTH = 5`）。横・縦・斜め（2 方向）を判定。
  - 着手順: 黒 → 白 の交互。クリック済みセルには着手不可。
  - AI 対戦: AI は白番固定。以下の思考で着手。
    1. 即勝ち手があれば取る
    2. 相手（黒）の即勝ち手があればブロック
    3. 連の延長と中心寄りを優先するヒューリスティック
- 勝利処理: 対象ラインに `win` クラスを付与、ステータスを更新。
- 引き分け処理: 盤面が埋まった時点で宣言。
- リセット: 盤面と状態を初期化し「黒の番です」を表示。

## 4. 操作フロー
1. ページ読み込み時に盤面生成。
2. セルクリックで石を配置し、即時に勝利／引き分け判定。
3. ゲーム終了後はリセットで新規対局。
4. ステータス文言・視覚ハイライト・（設定に応じて）吹き出し/TTSで状況を通知。

## 5. 技術仕様
- HTML: `index.html`（ES Modules, `type="module"`）。
- CSS: `styles/style.css`。
- JavaScript（SRP 構成）:
  - `src/core/gomoku.js` … 盤面・勝敗ロジック（純粋関数）
  - `src/ai/ai.js` … AI 思考ロジック
  - `src/ui/script.js` … DOM 制御と UI（オプション、ステータス、盤面生成）
  - `src/ui/dom.js` … UI 補助（ラベル、セル生成、勝利ハイライト）
  - `src/vrm/vrm.js` … VRM 表示・表情制御・吹き出し・TTS 実行
- TTS（音声合成）:
  - Web Speech API: `speechSynthesis` によりブラウザ内蔵音声を使用。
  - VOICEVOX: ローカルエンジン（`http://127.0.0.1:50021`）に Node プロキシ経由でアクセス。
    - プロキシ API（`server.js`）:
      - `GET  /api/voicevox/speakers` … 話者一覧
      - `POST /api/voicevox/tts` … `audio_query`→`synthesis` を中継し `audio/wav` を返却
      - CORS 許可（GitHub Pages など別オリジンからの利用を想定）
    - UI から `baseUrl` を設定可能（既定 `/api/voicevox`）。
    - 失敗時は Web Speech にフォールバック。
  - 設定 API（グローバル）:
    - `window.vrmVoice.config({ engine, enabled, voiceURI, rate, pitch, volume, baseUrl, speaker, speedScale, pitchScale, intonationScale, volumeScale })`
- パッケージ管理: npm（`package.json`）。

## 6. テスト
### 6.1 ユニットテスト
- フレームワーク: Node.js 組み込みの `node:test`。
- 対象: 盤面生成、石配置のバリデーション、勝利判定、盤面フル判定。
- コマンド: `npm run test:unit`（もしくは `npm test`）。

### 6.2 E2E テスト
- ツール: Playwright（`@playwright/test`）。
- 実装: `tests/e2e/gomoku.spec.js`
  - 黒の横一列勝利シナリオ。
  - リセット操作で盤面が初期化されるシナリオ。
- コマンド: `npm run test:e2e`。

## 7. ディレクトリ構成（主要ファイル）
`
/
├─ index.html               … UI エントリ
├─ styles/
│  └─ style.css             … スタイル
├─ src/
│  ├─ core/
│  │  └─ gomoku.js          … ゲームロジック
│  ├─ ai/
│  │  └─ ai.js              … AI ロジック
│  ├─ ui/
│  │  ├─ script.js          … UI 制御・オプション
│  │  └─ dom.js             … UI 補助関数
│  └─ vrm/
│     └─ vrm.js             … VRM/吹き出し/TTS 実装
├─ server.js                … 静的配信 + VOICEVOX プロキシ（CORS）
├─ tests/
│  ├─ gomoku.test.js        … ユニットテスト
│  └─ e2e/
│     └─ gomoku.spec.js     … Playwright E2E
├─ playwright.config.js     … Playwright 設定
├─ package.json             … npm 構成
└─ package-lock.json        … 依存関係ロック
`

## 8. ビルド・実行
- ローカル開発: `npm start` で `http://localhost:3000` を配信（キャッシュ抑止）。
- 直接実行: 任意の静的サーバで `index.html` を配信。
- Playwright: `npm run test:e2e` で静的サーバを自動起動して E2E 実行。

### 8.1 TTS（VOICEVOX）連携
1) VOICEVOX エンジンを起動（既定: `http://127.0.0.1:50021`）
- Docker 例: `docker run -p 50021:50021 voicevox/voicevox_engine:cpu-ubuntu20.04-latest`
2) 本アプリのローカルサーバを起動: `npm start`（`/api/voicevox/*` プロキシ有効）
3) 画面右上の ⚙ → 音声合成（TTS）
- 「吹き出しを読み上げる」ON
- エンジン: VOICEVOX（ローカル）
- API ベースURL（GitHub Pages 等から利用時）: `http://127.0.0.1:3000/api/voicevox`
- 話者・速度・ピッチ・抑揚・音量を調整

注意: 公開環境（HTTPS）からローカル HTTP へのアクセスはブラウザの制約（CORS/Mixed Content）の影響を受けます。本サーバのプロキシは CORS を許可していますが、必要に応じてローカルでの検証、または HTTPS 化をご検討ください。

## 9. 拡張余地
- 置石ルール・盤サイズ設定の拡張。
- 勝敗履歴やスコアボードの実装。
- 盤面のタップ操作向け UI 改善、アクセシビリティテスト追加。
- CI/CD パイプライン上での Playwright 実行とスクリーンショット保存。


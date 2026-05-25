# 【脱キーボード】GPT Realtime Whisper で音声入力ツールをリメイク

> Published at: https://qiita.com/hmkc1220/items/317c3eeb3fc5443c5bf7

[![Release](https://img.shields.io/github/v/release/TakanariShimbo/whisper-anywhere?include_prereleases&display_name=tag)](https://github.com/TakanariShimbo/whisper-anywhere/releases)
[![License](https://img.shields.io/badge/license-MIT-blue)](https://github.com/TakanariShimbo/whisper-anywhere/blob/main/LICENSE)

<p align="center">
  <img src="https://raw.githubusercontent.com/TakanariShimbo/whisper-anywhere/main/docs/hero.gif" alt="WhisperAnywhere demo" width="720" />
</p>

<p align="center"><em>ChatGPT のプロンプト欄に音声で入力する例。ホットキー押下 → 中央パネルにリアルタイム文字起こし → 確定で ChatGPT の入力欄へ自動貼り付け。</em></p>

## はじめに

これまで音声入力ツールに関して 2 本の記事を書いてきました。

- [【脱キーボード】Open Super Whisper で極上の文字起こし体験を手に入れる方法](https://qiita.com/hmkc1220/items/a8bcb6a26554dd27939a)
- [【MCP対応】声で AI エージェントを動かすアプリを作ったんだなも](https://qiita.com/hmkc1220/items/3dea024f489b9d9a24af)

1 本目では「音声 → 文字起こし → 出力」のシンプルな道具を、2 本目では「音声 → エージェント処理 → 行動」というところまで踏み込んだ V2 を紹介しました。

しかし、**実際に使い込んでみて気づいたこと**があります。

> エージェント機能やコマンド連携より、結局のところ **「リアルタイムで高精度な文字起こし」が一番効くんだ**ということ。

これが、もう一度作り直そうと思った直接の動機です。

この記事は **V3 にあたる新作 [WhisperAnywhere](https://github.com/TakanariShimbo/whisper-anywhere) の紹介** と、技術スタック・実装上の判断の記録です。

## 1. WhisperAnywhere とは ✨

**ホットキーで音声を入力し、リアルタイムに文字起こしして、いま開いているアプリの入力欄にそのまま貼り付ける**デスクトップアプリです。

```text
ホットキー  →  喋る  →  リアルタイム文字起こし  →  もう一度ホットキー  →  アクティブな入力欄に paste
```

メール / Slack / ブラウザ / VS Code / Claude Code / ChatGPT — **どこにフォーカスがあってもそのまま貼り付き**ます。

## 2. なぜ作り直すのか 🤔

### 2‑1. V2 で増やした機能を振り返って

V2 では MCP 連携・エージェント化・複数 LLM 切替・Playwright 経由のブラウザ操作など、**「文字起こしの先」をどんどん広げる**方針で機能を増やしました。

それはそれで面白かったのですが、**自分自身が一番触っていた機能**は、結局のところ:

1. 録音する
2. 文字に起こす
3. 入力欄に貼り付ける

…**この 3 ステップに収束**していたんです。エージェント機能はインパクトありますが、日頃使い慣れている ChatGPT や Claude Code に都度お願いしてしまうことのほうが多かったです。

### 2‑2. 「精度・速度」が伸び代だった

そうなると次に効くのは何かというと:

- **文字起こしの精度** — 漢字変換、句読点、固有名詞
- **リアルタイム文字起こし** — 話している途中で「今ちゃんと拾えてる？」と確認できるか
- **確定までの時間** — 喋り終えてから入力欄に貼り付くまでの体感

これらが「使うか / 使わないか」を分けるラインでした。V1/V2 では `Whisper API` (v1) を batch で使っていたので、**リアルタイム文字起こしをそもそも見られない** = 喋りながらの確認ができない、という痛みがありました。

### 2‑3. `gpt-realtime-whisper` の登場

ここに OpenAI Realtime API の `gpt-realtime-whisper` モデルがハマりました。

- **WebSocket でストリーミング**: 音声を 40ms チャンクで送り、リアルタイムで文字起こしされる
- **モデル自体が gpt-4o 系**: 文脈理解が強く、句読点や同音異義語の処理が滑らか
- **言語ヒント (`language` フィールド) サポート**: 認識速度と精度がさらに上がる

「これは V3 を作るに値する」と判断しました。

---

## 3. 技術スタックを TypeScript + Electron に変更 🛠

### 3‑1. V1/V2 までの構成

- Python + PyInstaller
- グローバルホットキー: `pynput`
- UI: PyQt6
- クリップボード: PyQt6 の `QApplication.clipboard()` で**自動コピーまで**（**自動貼り付けは未実装**、ユーザーが手動で Ctrl+V する運用）
- 文字起こし: OpenAI Whisper API (batch、`audio.transcriptions.create`)

これでも動くものは動いていたのですが、

- **「自動コピー」までしかなく、毎回 Ctrl+V するひと手間**が残っていた
- **配布バイナリのサイズが膨張**（V1 は ~67MB、V2 では WebEngine を抱え込んだ結果 **~324MB**）
- **マイク取得が macOS の権限ダイアログとうまく付き合えない**
- **CI で 3 OS 分のバイナリを一発生成する仕組みが無く**、配布が手作業寄り

…という辛さがありました。

### 3‑2. ChatGPT との壁打ちで Electron に決めた

「V3 はどの技術スタックで作るのが良いか」を ChatGPT と整理しました。要件は:

1. **マルチプラットフォーム** (Linux / macOS / Windows)
2. **配布が楽** (1 ファイルで終わるのが理想)
3. **ホットキー・トレイ・通知が安定**
4. **UI を自由に作れる** (React / 任意の CSS)
5. **マイク取得が楽**
6. **WebSocket クライアント (Realtime API 用)**

候補は Tauri / Electron / Wails / Flutter Desktop / SwiftUI などが挙がりましたが、**Electron が一番要件を満たす**という結論になりました:

- ✅ `globalShortcut` ・ `Tray` ・ `Notification` が公式 API として安定
- ✅ Renderer は React、`getUserMedia` でマイク取得そのまま
- ✅ `electron-builder` で `.deb`/`.AppImage` / `.dmg` / `.exe` を CI 一発で生成
- ✅ Node 側でそのまま WebSocket クライアントが使える (`ws`)
- ✅ TypeScript で main / preload / renderer / shared の型を一気通貫

「バイナリサイズが大きい」「メモリを食う」というデメリットはありますが、開発者として作るときの**ストレスの低さ**を最優先しました。

## 5. インストール 💾

[Releases](https://github.com/TakanariShimbo/whisper-anywhere/releases) から OS 別のファイルを入手してください。

| OS                    | ファイル      | 備考                                              |
| --------------------- | ------------- | ------------------------------------------------- |
| Linux                 | `.deb`        | 推奨。Activities にも自動登録、xdotool も依存解決 |
| Linux                 | `.AppImage`   | portable 実行ファイル                             |
| macOS (Apple Silicon) | `-arm64.dmg`  | 未署名のため初回は Control+クリック → 開く        |
| macOS (Intel)         | `.dmg`        | 同上                                              |
| Windows               | `Setup-*.exe` | SmartScreen は「詳細情報 → 実行」で OK            |

例: Ubuntu の場合

```bash
sudo apt install ./whisper-anywhere_0.4.1_amd64.deb
```

初回起動で設定ウィンドウが自動で開くので、**OpenAI API キーを入力 → 保存**。あとは `Ctrl+Shift+Space` で録音開始 → 喋る → もう一度押す、で完成です。

## 6. まとめ

V2 の MCP / エージェント連携も楽しい挑戦でしたが、結果として **「リアルタイム文字起こしの精度と速度」が音声入力ツールにおける UX の根幹**だった、という気づきがあって、もう一度作り直しました。

技術スタックを **Python + PyInstaller → TypeScript + Electron** に変えたことで、過去の実装で苦戦したホットキー・UI・配布まわりの摩擦が劇的に下がり、`gpt-realtime-whisper` を使ったストリーミング文字起こしという本来やりたかったことに時間を集中できました。

## リンク

- 📦 **リポジトリ**: https://github.com/TakanariShimbo/whisper-anywhere
- 🎁 **Releases**: https://github.com/TakanariShimbo/whisper-anywhere/releases
- 📖 **README (日本語)**: https://github.com/TakanariShimbo/whisper-anywhere/blob/main/README.md
- 📖 **README (English)**: https://github.com/TakanariShimbo/whisper-anywhere/blob/main/README.en.md
- 📝 **前作 V2 の記事**: https://qiita.com/hmkc1220/items/3dea024f489b9d9a24af
- 📝 **前作 V1 の記事**: https://qiita.com/hmkc1220/items/a8bcb6a26554dd27939a

> 🤝 **最後までお読みいただきありがとうございました！**
>
> 「使ってみたよ」「もっとこういう機能が欲しい」など、フィードバックは GitHub の [Issues](https://github.com/TakanariShimbo/whisper-anywhere/issues) や **⭐️ Star** でお待ちしています。

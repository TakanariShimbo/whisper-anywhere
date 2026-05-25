# 【再挑戦】`gpt-realtime-whisper` × Electron で「リアルタイム文字起こし → どこにでも貼り付け」ツールを作り直した

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

しかし、**実際に毎日使い込んでみて気づいたこと**があります。

> エージェント機能やコマンド連携より、結局のところ **「リアルタイムで高精度な文字起こし」が一番効くんだ**ということ。

これが、もう一度作り直そうと思った直接の動機です。

この記事は **V3 にあたる新作 [WhisperAnywhere](https://github.com/TakanariShimbo/whisper-anywhere) の紹介** と、技術スタック・実装上の判断の記録です。

---

## 1. WhisperAnywhere とは ✨

**ホットキーで音声を入力し、リアルタイムに文字起こしして、いま開いているアプリの入力欄にそのまま貼り付ける**デスクトップアプリです。

```text
ホットキー  →  喋る  →  リアルタイム文字起こし  →  もう一度ホットキー  →  アクティブな入力欄に paste
```

メール / Slack / ブラウザ / VS Code / Claude Code / ChatGPT — **どこにフォーカスがあってもそのまま貼り付き**ます。

### 1‑1. 3 つのウィンドウで役割を分離

- **右下のステータスインジケーター** （状態のみ表示）
- **画面中央の文字起こしパネル** （テキストのみ表示、自動スクロール）
- **設定ウィンドウ** （API キー / ホットキー / 言語）

V1/V2 では「インジケーターに状態とテキストを両方詰め込む」設計でしたが、**役割を完全に分離**したことで、目線の誘導がシンプルになりました。

### 1‑2. 設定 GUI

| 項目 | 内容 |
|---|---|
| OpenAI API キー | OS Keychain で暗号化保存（`safeStorage`） |
| ホットキー | 「変更」ボタン → **実キー押下で自動キャプチャ** |
| 文字起こし言語 | Auto / 日本語 / English / 中国語 / ... |
| 表示言語 (UI) | 日本語 / English（即時切替） |
| ログイン時に起動 | macOS / Windows / Linux 対応、初回起動でデフォルト ON |

---

## 2. なぜ作り直すのか 🤔

### 2‑1. V2 で増やした機能を振り返って

V2 では MCP 連携・エージェント化・複数 LLM 切替・Playwright 経由のブラウザ操作など、**「文字起こしの先」をどんどん広げる**方針で機能を増やしました。

それはそれで面白かったのですが、**自分自身が一番触っていた機能を分析**したら、結局は:

1. 録音する
2. 文字に起こす
3. 入力欄に貼り付ける

…**この 3 ステップに収束**していたんです。エージェント機能はたまに「すごい」と思って使うけど、**頻度で見ると地味な文字起こしの方が圧倒的**でした。

### 2‑2. 「精度・速度」が伸び代だった

そうなると次に効くのは何かというと:

- **文字起こしの精度** — 漢字変換、句読点、固有名詞
- **partial 表示のレイテンシ** — 話している途中で「今ちゃんと拾えてる？」と確認できるか
- **確定までの時間** — 喋り終えてから入力欄に貼り付くまでの体感

これらが「使うか / 使わないか」を分けるラインでした。V1/V2 では `Whisper API` (v1) を batch で使っていたので、**partial がそもそも見られない** = 喋りながらの確認ができない、という痛みがありました。

### 2‑3. `gpt-realtime-whisper` の登場

ここに OpenAI Realtime API の `gpt-realtime-whisper` モデルがハマりました。

- **WebSocket でストリーミング**: 音声を 40ms チャンクで送り、partial が流れる
- **モデル自体が gpt-4o 系**: 文脈理解が強く、句読点や同音異義語の処理が滑らか
- **言語ヒント (`language` フィールド) サポート**: 認識速度と精度がさらに上がる

「これは V3 を作るに値する」と判断しました。

---

## 3. 技術スタックを Python → TypeScript + Electron に変更 🛠

### 3‑1. V1/V2 までの構成

- Python + PyInstaller
- グローバルホットキー: `keyboard` / `pynput` を駆使
- 自動貼り付け: `pyperclip` + `pyautogui` の合わせ技
- UI: tkinter で自前描画

これでも動くものは動いていたのですが、

- **ホットキーが OS ごとに挙動が違い**、配布版で動かないことが多々
- **UI の見栄えが古い**（tkinter は限界がある）
- **配布バイナリのサイズが巨大**（PyInstaller で 200MB 超）
- **マイク取得が macOS の権限ダイアログとうまく付き合えない**

…という慢性的な辛さがありました。

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

---

## 4. 実装で楽になったポイント

### 4‑1. グローバルホットキー — `globalShortcut` 一発

Python 時代は OS ごとに別ライブラリを試行錯誤していた箇所が、Electron では:

```ts
import { globalShortcut } from 'electron'

globalShortcut.register('CommandOrControl+Shift+Space', () => {
  onHotkey()
})
```

これだけ。さらに **設定画面で「実キー押下からアクセラレータ文字列を自動生成」する UI** も以下のようにブラウザイベントで処理できます。

```ts
const onKeyDown = (e: KeyboardEvent) => {
  e.preventDefault()
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  parts.push(e.code.replace(/^Key/, ''))
  onChange(parts.join('+'))  // → "CommandOrControl+Shift+Space"
}
```

Python の `keyboard` ライブラリで未押下のキーを取れるか四苦八苦していた頃と比べると別世界です。

### 4‑2. UI — React で 3 ウィンドウ + 自動 i18n

3 種類のウィンドウ（ミニ・文字起こし・設定）をそれぞれ React で書いて、`shared/i18n.ts` の翻訳テーブルで日本語 / 英語をライブ切替。

```ts
// 設定保存時に main から broadcast
ipcMain.handle(IPC.SettingsSave, async (_, update) => {
  if (update.uiLanguage) {
    setCurrentUILanguage(update.uiLanguage)
    applyTrayMenu(tray, trayActions) // トレイメニューも作り直し
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send(IPC.SettingsChanged, update.uiLanguage)
    }
  }
})
```

renderer 側は `useI18n()` フックがこの broadcast を購読して、**再起動不要で全 UI が瞬時に切り替わる**仕様です。

### 4‑3. リアルタイム文字起こしへの接続

肝心の `gpt-realtime-whisper` への接続もシンプルです。

```ts
import WebSocket from 'ws'

const ws = new WebSocket(
  'wss://api.openai.com/v1/realtime?intent=transcription',
  { headers: { Authorization: `Bearer ${apiKey}` } }
)

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'session.update',
    session: {
      type: 'transcription',
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24000 },
          transcription: {
            model: 'gpt-realtime-whisper',
            language: 'ja'  // ← v0.3.6 で追加。ISO-639-1 ヒント
          }
        }
      }
    }
  }))
})
```

renderer 側は `AudioWorklet` で Float32 → Int16 LE に変換した PCM を 40ms ずつ IPC で main に送り、main がそれを base64 にして `input_audio_buffer.append` で WS に流すだけです。

```ts
// AudioWorklet 内: 24kHz / mono / Int16 / 40ms chunks
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0]
    if (!ch) return true
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]))
      this.buffer[this.offset++] = s < 0 ? s * 0x8000 : s * 0x7fff
      if (this.offset === 960) {
        this.port.postMessage(this.buffer, [this.buffer.buffer])
        this.buffer = new Int16Array(960)
        this.offset = 0
      }
    }
    return true
  }
}
```

partial / final transcript はそのまま JSON イベントで返ってくるので、main → renderer に流せば中央パネルにスルスル文字が流れます。

### 4‑4. 自動貼り付け

OS 別の自動 paste も、TS なら 3 分岐で書けます。

```ts
if (process.platform === 'linux') {
  await execAsync('xdotool key --clearmodifiers ctrl+v')
} else if (process.platform === 'darwin') {
  await execAsync('osascript -e \'tell application "System Events" to keystroke "v" using command down\'')
} else if (process.platform === 'win32') {
  await execAsync('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^v\')"')
}
```

`.deb` パッケージの場合、`xdotool` も依存関係として自動でインストールされるので、ユーザー側は意識しなくて OK です。

---

## 5. 配布まわりも CI で自動化

`electron-builder` × GitHub Actions の matrix ビルドで、**タグを打って push するだけ**で 3 OS 分の成果物が draft Release に揃います。

```yaml
# .github/workflows/release.yml (抜粋)
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with: { node-version-file: .nvmrc, cache: npm }
  - run: npm ci
  - name: Sync version from tag
    run: |
      VERSION="${GITHUB_REF#refs/tags/v}"
      npm version "$VERSION" --no-git-tag-version --allow-same-version
  - run: npm run build
  - run: npx electron-builder --publish always
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      CSC_IDENTITY_AUTO_DISCOVERY: 'false'
```

ローカルでバージョンを手で bump する必要すらありません。`git tag v0.4.0 && git push origin v0.4.0` だけ。

---

## 6. インストール 💾

[Releases](https://github.com/TakanariShimbo/whisper-anywhere/releases) から OS 別のファイルを入手してください。

| OS | ファイル | 備考 |
|---|---|---|
| Linux | `.deb` | 推奨。Activities にも自動登録、xdotool も依存解決 |
| Linux | `.AppImage` | portable 実行ファイル |
| macOS (Apple Silicon) | `-arm64.dmg` | 未署名のため初回は Control+クリック → 開く |
| macOS (Intel) | `.dmg` | 同上 |
| Windows | `Setup-*.exe` | SmartScreen は「詳細情報 → 実行」で OK |

例: Ubuntu の場合

```bash
sudo apt install ./whisper-anywhere_0.4.0_amd64.deb
```

初回起動で設定ウィンドウが自動で開くので、**OpenAI API キーを入力 → 保存**。あとは `Ctrl+Shift+Space` で録音開始 → 喋る → もう一度押す、で完成です。

---

## 7. まとめ

V2 の MCP / エージェント連携も楽しい挑戦でしたが、結果として **「リアルタイム文字起こしの精度と速度」が音声入力ツールにおける UX の根幹**だった、という気づきがあって、もう一度作り直しました。

技術スタックを **Python + PyInstaller → TypeScript + Electron** に変えたことで、過去の実装で苦戦したホットキー・UI・配布まわりの摩擦が劇的に下がり、`gpt-realtime-whisper` を使ったストリーミング文字起こしという本来やりたかったことに時間を集中できました。

### 主な変更点まとめ

| 観点 | V1/V2 | V3 (WhisperAnywhere) |
|---|---|---|
| 文字起こし | Whisper API (batch) | **gpt-realtime-whisper (streaming)** |
| 言語 / フレームワーク | Python + tkinter | **TypeScript + Electron + React** |
| 配布 | PyInstaller (200MB+) | electron-builder (80MB+, CI matrix 自動) |
| ホットキー | OS 別ライブラリ | `globalShortcut` 一本 |
| マイク取得 | sounddevice 等 | `getUserMedia` + `AudioWorklet` |
| 自動貼り付け | pyautogui | OS 別シェル呼び出し |
| UI 言語切替 | なし | 日本語 / English (即時) |
| 設定の暗号化 | なし | OS Keychain (`safeStorage`) |

---

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

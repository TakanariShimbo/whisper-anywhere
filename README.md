# WhisperAnywhere

ホットキーで音声を入力し、リアルタイムに文字起こしして、フォーカス中のアプリの入力欄へそのまま貼り付けるデスクトップアプリ。

メール、チャット、ブラウザ、エディタ、Claude Code、ChatGPT など、どこからでも声で入力できる。

## 動作環境

| OS      | 動作 | 備考 |
|---------|------|------|
| Linux (X11) | ✅ | 自動貼り付けに `xdotool` が必要 |
| macOS   | ✅ | 初回起動時にマイク許可・アクセシビリティ許可を求められる |
| Windows | ✅ | PowerShell SendKeys で貼り付け |
| Linux (Wayland) | ❌ | 未対応（`ydotool` ベースで今後対応予定） |

## 使い方

1. インストール（[Releases](https://github.com/TakanariShimbo/whisper-anywhere/releases) から OS 別のパッケージを入手）
2. 起動 → トレイにマイクアイコン
3. 初回は設定ウィンドウが自動で開くので **OpenAI API キー** を入力
4. 任意のアプリでカーソルを入力欄に置く
5. ホットキー（既定 `Ctrl+Shift+Space`）→ 録音開始
6. 話す
7. もう一度ホットキー → 文字起こし結果が貼り付く

ホットキーは設定画面で実キー押下から変更可能。

## 開発

### 前提

- Node.js 22+（`.nvmrc` あり）
- Linux 開発時のみ:
  - `chrome-sandbox` の SUID 設定（初回 `npm install` 後に 1 度だけ）

    ```bash
    sudo chown root:root node_modules/electron/dist/chrome-sandbox
    sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
    ```

  - `xdotool`（自動貼り付け用）

    ```bash
    sudo apt install xdotool
    ```

### 起動

```bash
nvm use
npm ci
OPENAI_API_KEY='sk-…' npm run dev
```

API キーは設定 GUI から保存しておけば次回以降は環境変数不要（OS Keychain で暗号化保存）。

### ビルド（ローカル）

```bash
npm run pack:linux   # AppImage + .deb
npm run pack:mac     # .dmg + .zip（macOS でのみ実行可）
npm run pack:win     # .exe (NSIS)（Windows でのみ実行可推奨）
```

成果物は `release/` に出力される。

### リリース手順

1. `package.json` の `version` を上げる
2. main にコミット
3. タグを打って push

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

4. GitHub Actions が ubuntu / macOS / windows ランナーで並行ビルド → **draft** リリースに各成果物を自動アップロード
5. GitHub の Releases 画面で内容を確認して publish

## アーキテクチャ

```
src/
├─ main/             # Electron メインプロセス
│  ├─ index.ts       # bootstrap、状態機械、IPC
│  ├─ hotkey.ts      # globalShortcut のラッパ
│  ├─ tray.ts        # トレイメニュー
│  ├─ window.ts      # 小窓 (transparent, frameless, focusable:false)
│  ├─ settingsWindow.ts
│  ├─ realtimeClient.ts # OpenAI Realtime API への WS クライアント
│  ├─ paste.ts       # OS 別の自動貼り付け
│  ├─ settings.ts    # JSON 永続化 + safeStorage 暗号化
│  ├─ log.ts         # 簡易ロガー
│  └─ assets/        # アイコン素材
│
├─ preload/          # contextBridge で whisper API を公開
│  └─ index.ts
│
├─ renderer/
│  ├─ index.html         # 小窓
│  ├─ settings.html      # 設定画面
│  ├─ public/audio-worklets/pcm-processor.js  # PCM 変換 worklet
│  └─ src/
│     ├─ App.tsx, main.tsx
│     ├─ components/MiniWindow.tsx
│     ├─ audio/recorder.ts, useRecorder.ts
│     ├─ stores/statusStore.ts
│     ├─ settings/App.tsx, main.tsx, HotkeyCapture.tsx
│     └─ global.d.ts
│
└─ shared/           # main / renderer 共通の型・定数
   ├─ ipc.ts
   └─ settings.ts
```

## ライセンス

未定（必要に応じて MIT 等を後日設定）

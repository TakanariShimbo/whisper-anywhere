# CLAUDE.md

## 開発環境

- OS: Ubuntu
- `uv` と `nvm` はインストール済み

## 仮想環境の方針

Python / Node.js を利用する際は、**プロジェクト直下**に仮想環境を作成すること。グローバル環境は使わない。

### Python (uv)

```bash
# 新規プロジェクト
uv init                    # pyproject.toml 等を生成
uv init --python 3.12      # Python バージョンを指定する場合
# ↑ 生成される main.py / 空 README.md は不要なら削除

# 既存プロジェクト
uv sync                    # pyproject.toml から .venv を復元

# パッケージ追加
uv add <package>

# 実行(venv を activate しない)
uv run <script.py>
uv run python -m <module>
```

### Node.js (nvm)

LTS は導入済み。プロジェクト直下で:

```bash
# 新規 ─ 共通: Node バージョンを固定
echo "lts/*" > .nvmrc      # 最新 LTS で固定
echo "22.17.0" > .nvmrc    # バージョンを指定する場合
nvm install && nvm use

# 新規 ─ A) プレーン(ライブラリ、CLI 等)
npm init -y                # package.json のみ作成

# 新規 ─ B) フレームワーク scaffold(プロジェクト直下に展開)
npm create vite@latest .   # Vite (React / Vue / Svelte 等)
                           # 他に Next.js / Nuxt / Astro / Remix / Qwik など
npm install                # scaffold した package.json から依存を導入

# 既存プロジェクト
nvm install                # .nvmrc のバージョンが未導入なら入れる
nvm use                    # .nvmrc のバージョンに切替
npm ci                     # package-lock.json どおりに node_modules/ を復元

# パッケージ追加
npm install <package>
```

## 注意

- 初期化コマンドが生成した不要なファイル(`main.py` / 空 `README.md` 等)は削除する
- `.gitignore` は `.venv/` と `node_modules/` を最低限含める(`uv init` は Python 向けのみ生成)
- グローバルに `pip install` / `npm install -g` はしない(例外: `npm install -g npm@latest` で npm 自体の更新は可)
- Python は `.venv` を activate せず、必ず `uv run` 経由で実行する

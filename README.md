# 大阪全力SNS合宿 講義アーカイブ

合宿参加者向けの講義動画閲覧ページ（GitHub Pages）。動画本体は Loom に置き、ここでは埋め込みで再生する。

## パスワードの仕組み

- 講義データ（タイトル・Loom リンク）は `vault.js` に AES-GCM で暗号化して置いている。鍵はパスワードから PBKDF2 で導出する。
- 正しいパスワードで復号できたときだけ一覧とプレーヤーが表示される。パスワード自体はリポジトリのどこにも書いていない。
- 静的サイトなので、パスワードを知っている人は Loom のリンクを取り出せる。Loom 側の共有設定もあわせて確認すること。

## 動画リンクを差し替える

1. `lectures.json`（平文。`.gitignore` 済みでコミットされない）の各講義の `loom` に Loom の共有リンクを入れる
   例: `https://www.loom.com/share/xxxxxxxx` または `https://loom.aione.co.jp/v/xxxxxxxx`
   1講義に動画が複数あるときは `loom` の代わりに `parts`（`label`・`len`・`loom` の配列）を使う。
   `thumb` はサムネイル画像のパス（`thumbs/` に置く。これも `.gitignore` 済みで、vault.js に暗号化して同梱される）、`slide` は講義スライドの閲覧リンク。
2. `node tools/build-vault.mjs <パスワード>` で `vault.js` を作り直す
3. `vault.js` をコミットして push する

`loom` が空の講義は「準備中」と表示される。パスワードを変えるときも 2 のパスワードを変えて作り直すだけ。

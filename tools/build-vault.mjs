// lectures.json（平文・コミットしない）をパスワードで暗号化して vault.js を書き出す。
// 使い方: node tools/build-vault.mjs <パスワード>
// 鍵は PBKDF2-SHA256 から導出し、AES-GCM で暗号化する。復号できる＝パスワード一致。
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const password = process.argv[2];
if (!password) {
  console.error("usage: node tools/build-vault.mjs <password>");
  process.exit(1);
}

const ITER = 250000;
const enc = new TextEncoder();
const b64 = (u8) => Buffer.from(u8).toString("base64");

const data = JSON.parse(await readFile(join(root, "lectures.json"), "utf8"));
// サムネイルもログイン前に見えないよう、画像ファイルを data URL にして暗号化データへ同梱する
for (const l of data.lectures) {
  if (l.thumb) l.thumb = "data:image/jpeg;base64," + (await readFile(join(root, l.thumb))).toString("base64");
}
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));

const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER },
  base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data))));

const out = `// tools/build-vault.mjs が生成。手で編集しない。\nwindow.VAULT = ${JSON.stringify({ iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) })};\n`;
await writeFile(join(root, "vault.js"), out);

const ready = data.lectures.filter((l) => l.loom || (l.parts || []).some((p) => p.loom)).length;
console.log(`vault.js written (${data.lectures.length} lectures, ${ready} with Loom link)`);

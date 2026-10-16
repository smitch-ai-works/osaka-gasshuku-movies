// 講義データは vault.js に暗号化して置いてある。入力されたパスワードで復号できたときだけ表示する。
(() => {
  const $ = (id) => document.getElementById(id);
  const KEY = "osaka-archive-key";
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const toB64 = (u8) => btoa(String.fromCharCode(...u8));
  const store = {
    get: () => { try { return sessionStorage.getItem(KEY); } catch { return null; } },
    set: (v) => { try { sessionStorage.setItem(KEY, v); } catch {} },
    clear: () => { try { sessionStorage.removeItem(KEY); } catch {} },
  };

  async function deriveRaw(password) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: fromB64(VAULT.salt), iterations: VAULT.iter }, base, 256
    );
    return new Uint8Array(bits);
  }

  async function open(raw) {
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(VAULT.iv) }, key, fromB64(VAULT.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  // Loom の共有リンク（loom.com/share/ID）や AI ONE の共有リンク（loom.aione.co.jp/v/ID）を埋め込み用（/embed/ID）に変える
  function embedUrl(link) {
    const m = String(link || "").match(/(?:loom\.com\/(?:share|embed)|loom\.aione\.co\.jp\/v)\/([0-9a-f]{32})/i);
    return m ? `https://www.loom.com/embed/${m[1]}?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true` : "";
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function render(data) {
    // 1講義に動画が複数ある場合（講義とワークを分けて録った等）は parts に並べる
    const lectures = data.lectures.map((l) => ({ ...l, parts: l.parts || [{ loom: l.loom }] }));
    const ready = (l) => l.parts.some((p) => embedUrl(p.loom));
    $("gate").hidden = true;
    $("app").hidden = false;
    $("logout").hidden = false;

    $("list").innerHTML = lectures.map((l, i) => `
      <li data-i="${i}"><button type="button">
        <span class="no">${esc(l.no)}</span>
        <span class="tx"><em>${esc(l.slot)}</em><b>${esc(l.title)}</b><span>${esc(l.speaker)}${l.len ? ` ｜ ${esc(l.len)}` : ""}</span>
          <span class="st${ready(l) ? " play" : ""}">${ready(l) ? (l.parts.length > 1 ? `視聴できます（${l.parts.length}本）` : "視聴できます") : "準備中"}</span></span>
      </button></li>`).join("");

    function play(l, k) {
      const src = embedUrl(l.parts[k].loom);
      $("player").innerHTML = src
        ? `<iframe src="${src}" title="${esc(l.title)}" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`
        : `<div class="soon"><b>準備中</b><span>動画の公開まで少々お待ちください</span></div>`;
      document.querySelectorAll("#parts button").forEach((b) => b.classList.toggle("on", +b.dataset.k === k));
    }

    function select(i, scroll) {
      const l = lectures[i];
      const parts = l.parts.length > 1
        ? `<div class="parts" id="parts">${l.parts.map((p, k) => `
            <button type="button" data-k="${k}"><b>${esc(p.label)}</b>${p.len ? `<span>${esc(p.len)}</span>` : ""}</button>`).join("")}</div>`
        : "";
      $("current").innerHTML = `
        <p class="slot">${esc(l.slot)}</p>
        <h3>${esc(l.title)}</h3>
        <p class="who">講師 ｜ ${esc(l.speaker)}${l.len ? ` ｜ ${esc(l.len)}` : ""}</p>
        <p class="desc">${esc(l.desc)}</p>${parts}`;
      play(l, 0);
      document.querySelectorAll("#list li").forEach((li) => li.classList.toggle("on", +li.dataset.i === i));
      history.replaceState(null, "", `#${i + 1}`);
      if (scroll) $("now-label").scrollIntoView({ behavior: "smooth", block: "start" });
      current = l;
    }

    let current;
    $("current").addEventListener("click", (e) => {
      const b = e.target.closest("#parts button");
      if (b) play(current, +b.dataset.k);
    });

    $("list").addEventListener("click", (e) => {
      const li = e.target.closest("li");
      if (li) select(+li.dataset.i, true);
    });

    const fromHash = parseInt(location.hash.slice(1), 10) - 1;
    select(fromHash >= 0 && fromHash < lectures.length ? fromHash : 0, false);
  }

  const form = $("login");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const go = $("go");
    go.disabled = true;
    go.textContent = "確認中…";
    form.classList.remove("ng", "shake");
    try {
      const raw = await deriveRaw($("pw").value);
      const data = await open(raw);
      store.set(toB64(raw));
      render(data);
    } catch {
      $("err").hidden = false;
      void form.offsetWidth;
      form.classList.add("ng", "shake");
      $("pw").select();
    } finally {
      go.disabled = false;
      go.textContent = "講義を見る";
    }
  });

  $("logout").addEventListener("click", (e) => {
    e.preventDefault();
    store.clear();
    location.replace(location.pathname);
  });

  // 同じタブで開き直したときはパスワードを再入力させない
  const saved = store.get();
  if (saved) open(fromB64(saved)).then(render).catch(store.clear);
})();

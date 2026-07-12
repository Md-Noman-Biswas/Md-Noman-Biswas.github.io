/* ============================================================================
 * Admin panel for Md-Noman-Biswas.github.io
 * Pure static SPA. Reads/writes content files via the GitHub REST API and
 * commits to `main`, which triggers the existing Actions build (~1 min to live).
 * No backend, no third-party service. The GitHub token is the only credential.
 * ==========================================================================*/
(function () {
  "use strict";

  /* ------------------------------ Config ---------------------------------- */
  var REPO_OWNER = "Md-Noman-Biswas";
  var REPO_NAME  = "Md-Noman-Biswas.github.io";
  var BRANCH     = "main";
  var API        = "https://api.github.com";
  var SITE_URL   = "https://md-noman-biswas.github.io";

  var LS = {
    tokenPlain: "admin_gh_token",
    tokenEnc:   "admin_gh_token_enc",
    commitMsg:  "admin_default_commit_msg",
    theme:      "theme-setting"
  };

  /* ------------------------------- State ---------------------------------- */
  var token = null;          // in-memory only
  var user  = null;          // { login, name, avatar_url }
  var currentTab = "dashboard";
  var cache = {};            // path -> { sha, ... }

  var app = document.getElementById("app");

  /* ----------------------------- Utilities -------------------------------- */
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function utf8ToB64(str) {
    var bytes = new TextEncoder().encode(str), bin = "", chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(bin);
  }
  function b64ToUtf8(b64) {
    var bin = atob(String(b64).replace(/\s/g, "")), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function bufToB64(buf) {
    var bytes = new Uint8Array(buf), bin = "", chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(bin);
  }
  function encodePath(p) { return p.split("/").map(encodeURIComponent).join("/"); }

  function toast(msg, type) {
    var host = document.getElementById("toast-host");
    var t = el('<div class="toast ' + (type || "") + '">' + msg + "</div>");
    host.appendChild(t);
    setTimeout(function () { t.style.transition = "opacity .3s"; t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 300); }, type === "error" ? 6000 : 3500);
  }

  function defaultCommitMsg(what) {
    var tpl = localStorage.getItem(LS.commitMsg) || "admin: update {what}";
    return tpl.replace("{what}", what);
  }

  /* --------------------------- GitHub API core ---------------------------- */
  function api(path, opts) {
    opts = opts || {};
    var headers = {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (opts.headers) for (var k in opts.headers) headers[k] = opts.headers[k];
    return fetch(API + path, { method: opts.method || "GET", headers: headers, body: opts.body })
      .then(function (res) {
        if (res.status === 204) return null;
        return res.json().catch(function () { return {}; }).then(function (json) {
          if (!res.ok) {
            var e = new Error((json && json.message) || (res.status + " " + res.statusText));
            e.status = res.status; e.body = json; throw e;
          }
          return json;
        });
      });
  }
  function repoPath(sub) { return "/repos/" + REPO_OWNER + "/" + REPO_NAME + sub; }

  function getFile(path) {
    return api(repoPath("/contents/" + encodePath(path) + "?ref=" + BRANCH)).then(function (d) {
      return { sha: d.sha, text: b64ToUtf8(d.content || ""), size: d.size };
    });
  }
  function getFileShaOrNull(path) {
    // Works for large binaries too (lists parent dir instead of downloading).
    var dir = path.indexOf("/") >= 0 ? path.slice(0, path.lastIndexOf("/")) : "";
    var name = path.slice(path.lastIndexOf("/") + 1);
    return api(repoPath("/contents/" + encodePath(dir) + "?ref=" + BRANCH)).then(function (list) {
      if (!Array.isArray(list)) return null;
      var f = list.find(function (x) { return x.name === name; });
      return f ? f.sha : null;
    }).catch(function (e) { if (e.status === 404) return null; throw e; });
  }
  function putFileRaw(path, contentB64, sha, message) {
    var body = { message: message, content: contentB64, branch: BRANCH };
    if (sha) body.sha = sha;
    return api(repoPath("/contents/" + encodePath(path)), { method: "PUT", body: JSON.stringify(body) });
  }
  function saveText(path, text, message, cachedSha) {
    return putFileRaw(path, utf8ToB64(text), cachedSha, message).catch(function (e) {
      if (e.status === 409 || e.status === 422) {
        return getFileShaOrNull(path).then(function (sha) { return putFileRaw(path, utf8ToB64(text), sha, message); });
      }
      throw e;
    });
  }
  function saveBinary(path, contentB64, message) {
    return getFileShaOrNull(path).then(function (sha) { return putFileRaw(path, contentB64, sha, message); });
  }
  function deleteFile(path, sha, message) {
    return api(repoPath("/contents/" + encodePath(path)), { method: "DELETE", body: JSON.stringify({ message: message, sha: sha, branch: BRANCH }) });
  }

  /* ------------------------------ YAML I/O -------------------------------- */
  function dumpYaml(obj) {
    return jsyaml.dump(obj, { lineWidth: -1, noRefs: true, quotingType: '"', forceQuotes: false });
  }
  function loadYaml(text) { return jsyaml.load(text) || []; }

  function splitFrontMatter(text) {
    var m = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(text);
    if (!m) return { data: {}, body: text };
    return { data: jsyaml.load(m[1]) || {}, body: m[2] };
  }
  function joinFrontMatter(data, body) {
    return "---\n" + dumpYaml(data).replace(/\n$/, "") + "\n---\n" + (body || "");
  }

  /* ============================ Crypto (token) ============================= */
  function deriveKey(pass, salt, usage) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]).then(function (mat) {
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: 150000, hash: "SHA-256" }, mat,
        { name: "AES-GCM", length: 256 }, false, [usage]);
    });
  }
  function encryptToken(tok, pass) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(pass, salt, "encrypt").then(function (key) {
      return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(tok));
    }).then(function (ct) {
      return JSON.stringify({ s: Array.from(salt), i: Array.from(iv), c: bufToB64(ct) });
    });
  }
  function decryptToken(blob, pass) {
    var o = JSON.parse(blob), salt = new Uint8Array(o.s), iv = new Uint8Array(o.i);
    var ct = Uint8Array.from(atob(o.c), function (c) { return c.charCodeAt(0); });
    return deriveKey(pass, salt, "decrypt").then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
    }).then(function (pt) { return new TextDecoder().decode(pt); });
  }

  /* ============================ Auth / login ============================== */
  function validateToken(tok) {
    var saved = token; token = tok;
    return api("/user").then(function (u) {
      return api(repoPath("")).then(function (repo) {
        if (!repo.permissions || !repo.permissions.push) throw new Error("This token cannot write to the repository. Grant it Contents: Read and write.");
        user = { login: u.login, name: u.name || u.login, avatar_url: u.avatar_url };
        return true;
      });
    }).catch(function (e) { token = saved; throw e; });
  }

  function renderLogin(unlockBlob) {
    var isUnlock = !!unlockBlob;
    app.innerHTML = "";
    var card = el(
      '<div class="auth-wrap"><div class="auth-card">' +
        '<div class="auth-logo">🛠️</div>' +
        '<h1>' + (isUnlock ? "Unlock admin" : "Admin sign in") + '</h1>' +
        '<p class="auth-sub">' + (isUnlock
          ? "Enter your passphrase to decrypt your saved token."
          : "Paste a GitHub token with write access to this repository.") + '</p>' +
        (isUnlock
          ? '<div class="field"><label class="lbl">Passphrase</label><input type="password" id="pass" autofocus></div>'
          : ('<div class="field"><label class="lbl">GitHub token</label><input type="password" id="tok" placeholder="github_pat_… or ghp_…" autofocus></div>' +
             '<div class="field"><label class="lbl">Keep me signed in</label>' +
               '<div class="radio-row">' +
                 '<label><input type="radio" name="store" value="plain" checked><span>On this device <small>Token saved in this browser (localStorage). Convenient on your own machine.</small></span></label>' +
                 '<label><input type="radio" name="store" value="enc"><span>Encrypted with a passphrase <small>Safer on shared devices. You unlock with a passphrase each visit.</small></span></label>' +
                 '<label><input type="radio" name="store" value="session"><span>This session only <small>Forgotten when you close the tab.</small></span></label>' +
               '</div>' +
             '</div>' +
             '<div class="field" id="passWrap" style="display:none"><label class="lbl">Passphrase</label><input type="password" id="encpass"><div class="field-hint">Used to encrypt the token in this browser. There is no recovery — remember it.</div></div>' +
             helpBlock())) +
        '<button class="btn btn-primary" id="go" style="width:100%;justify-content:center;margin-top:.4rem">' + (isUnlock ? "Unlock" : "Sign in") + '</button>' +
        '<div id="err" style="color:var(--danger);font-size:.85rem;margin-top:.8rem"></div>' +
        (isUnlock ? '<div style="margin-top:1rem;text-align:center"><a href="#" id="forget">Use a different token</a></div>' : "") +
      '</div></div>'
    );
    app.appendChild(card);

    var errEl = card.querySelector("#err");
    function fail(m) { errEl.textContent = m; }

    if (!isUnlock) {
      var passWrap = card.querySelector("#passWrap");
      card.querySelectorAll('input[name=store]').forEach(function (r) {
        r.addEventListener("change", function () { passWrap.style.display = (card.querySelector('input[name=store]:checked').value === "enc") ? "block" : "none"; });
      });
    } else {
      card.querySelector("#forget").addEventListener("click", function (e) {
        e.preventDefault(); localStorage.removeItem(LS.tokenEnc); renderLogin(null);
      });
    }

    card.querySelector("#go").addEventListener("click", function () {
      var btn = this; btn.disabled = true; fail("");
      var done = function () { btn.disabled = false; };
      if (isUnlock) {
        var pass = card.querySelector("#pass").value;
        decryptToken(unlockBlob, pass).then(function (tok) {
          return validateToken(tok).then(function () { enterApp(); });
        }).catch(function () { fail("Wrong passphrase, or the token is no longer valid."); done(); });
      } else {
        var tok = card.querySelector("#tok").value.trim();
        if (!tok) { fail("Please paste a token."); done(); return; }
        var mode = card.querySelector('input[name=store]:checked').value;
        validateToken(tok).then(function () {
          if (mode === "plain") { localStorage.setItem(LS.tokenPlain, tok); localStorage.removeItem(LS.tokenEnc); return enterApp(); }
          if (mode === "session") { sessionStorage.setItem(LS.tokenPlain, tok); localStorage.removeItem(LS.tokenPlain); localStorage.removeItem(LS.tokenEnc); return enterApp(); }
          var pw = card.querySelector("#encpass").value;
          if (!pw) { fail("Enter a passphrase to encrypt the token."); done(); return; }
          return encryptToken(tok, pw).then(function (blob) { localStorage.setItem(LS.tokenEnc, blob); localStorage.removeItem(LS.tokenPlain); enterApp(); });
        }).catch(function (e) { fail(e.message || "Sign in failed."); done(); });
      }
    });
    card.addEventListener("keydown", function (e) { if (e.key === "Enter") card.querySelector("#go").click(); });
  }

  function helpBlock() {
    return '<details class="help"><summary><i class="fa-solid fa-circle-question"></i> How do I create a token?</summary><ol>' +
      '<li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Fine-grained tokens → Generate new</a>.</li>' +
      '<li>Set an <b>expiry</b> (e.g. 90 days) and under <b>Repository access</b> choose <b>Only select repositories</b> → <code>' + REPO_NAME + '</code>.</li>' +
      '<li>Under <b>Permissions → Repository</b>, set <b>Contents</b> to <b>Read and write</b>. Leave everything else off.</li>' +
      '<li>Generate, copy the token, and paste it above. You can revoke it anytime from the same page.</li>' +
      '</ol></details>';
  }

  /* ============================== App shell =============================== */
  var TABS = [
    { id: "dashboard",    label: "Dashboard",          icon: "fa-gauge-high" },
    { id: "profile",      label: "Profile",            icon: "fa-id-card" },
    { id: "interests",    label: "Research Interests", icon: "fa-lightbulb" },
    { id: "news",         label: "Recent News",        icon: "fa-bullhorn" },
    { id: "publications", label: "Publications",       icon: "fa-book" },
    { id: "projects",     label: "Projects",           icon: "fa-diagram-project" },
    { id: "cv",           label: "CV",                 icon: "fa-file-lines" },
    { id: "blog",         label: "Blog",               icon: "fa-pen-nib" },
    { id: "media",        label: "Media",              icon: "fa-image" },
    { id: "settings",     label: "Settings",           icon: "fa-gear" }
  ];

  function enterApp() {
    app.innerHTML = "";
    var shell = el(
      '<div class="admin-shell">' +
        '<div class="backdrop" id="backdrop"></div>' +
        '<aside class="sidebar" id="sidebar">' +
          '<div class="brand">🛠️ Admin<small>' + esc(REPO_NAME) + '</small></div>' +
          '<nav class="nav" id="nav"></nav>' +
          '<div class="sidebar-foot">' +
            '<div class="who"><img src="' + esc(user.avatar_url) + '" alt=""><div><b>' + esc(user.name) + '</b><span>@' + esc(user.login) + '</span></div></div>' +
            '<div class="foot-actions">' +
              '<button class="btn btn-sm" id="lockBtn" title="Lock"><i class="fa-solid fa-lock"></i> Lock</button>' +
              '<button class="btn btn-sm" id="themeBtn" title="Theme"><i class="fa-solid fa-circle-half-stroke"></i></button>' +
              '<a class="btn btn-sm" href="' + SITE_URL + '" target="_blank" rel="noopener" title="View site"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>' +
            '</div>' +
          '</div>' +
        '</aside>' +
        '<main class="content">' +
          '<div class="topbar"><button class="btn btn-icon menu-btn" id="menuBtn"><i class="fa-solid fa-bars"></i></button><b>Admin</b></div>' +
          '<div id="view"></div>' +
        '</main>' +
      '</div>'
    );
    app.appendChild(shell);

    var nav = shell.querySelector("#nav");
    TABS.forEach(function (t) {
      var b = el('<button data-tab="' + t.id + '"><i class="fa-solid ' + t.icon + '"></i> ' + t.label + "</button>");
      b.addEventListener("click", function () { closeMenu(); go(t.id); });
      nav.appendChild(b);
    });

    shell.querySelector("#lockBtn").addEventListener("click", lock);
    shell.querySelector("#themeBtn").addEventListener("click", toggleTheme);
    var sb = shell.querySelector("#sidebar"), bd = shell.querySelector("#backdrop");
    function closeMenu() { sb.classList.remove("open"); bd.classList.remove("show"); }
    shell.querySelector("#menuBtn").addEventListener("click", function () { sb.classList.add("open"); bd.classList.add("show"); });
    bd.addEventListener("click", closeMenu);

    go(currentTab);
  }

  function go(tab) {
    currentTab = tab;
    document.querySelectorAll(".nav button").forEach(function (b) { b.classList.toggle("active", b.dataset.tab === tab); });
    var view = document.getElementById("view");
    view.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner spin"></i> Loading…</div>';
    var fn = ({ dashboard: viewDashboard, profile: viewProfile, interests: viewInterests, news: viewNews,
      publications: viewPublications, projects: viewProjects, cv: viewCV, blog: viewBlog, media: viewMedia, settings: viewSettings })[tab];
    Promise.resolve().then(function () { return fn(view); }).catch(function (e) {
      view.innerHTML = '<div class="empty"><i class="fa-solid fa-triangle-exclamation"></i><p>' + esc(e.message || "Failed to load.") + "</p></div>";
    });
  }

  function head(title, sub, actionsHtml) {
    return '<div class="page-head"><div><h2>' + esc(title) + "</h2>" + (sub ? "<p>" + sub + "</p>" : "") +
      '</div><div class="head-actions">' + (actionsHtml || "") + "</div></div>";
  }

  // Wire a Save button with spinner + toast + rebuild note.
  function bindSave(btn, fn, what) {
    btn.addEventListener("click", function () {
      var orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner spin"></i> Saving…';
      Promise.resolve().then(fn).then(function () {
        toast('<b>Saved.</b> ' + (what || "Changes") + " will be live in ~1 min.", "success");
      }).catch(function (e) { toast("Save failed: " + esc(e.message || e), "error"); })
        .then(function () { btn.disabled = false; btn.innerHTML = orig; });
    });
  }

  /* ============================= Dashboard =============================== */
  function viewDashboard(view) {
    return Promise.all([
      api(repoPath("/commits?sha=" + BRANCH + "&per_page=1")).catch(function () { return []; }),
      api(repoPath("/actions/runs?per_page=1")).catch(function () { return { workflow_runs: [] }; })
    ]).then(function (r) {
      var commit = (r[0] && r[0][0]) || null;
      var run = (r[1] && r[1].workflow_runs && r[1].workflow_runs[0]) || null;
      var when = commit ? new Date(commit.commit.author.date).toLocaleString() : "—";
      var runState = run ? (run.status === "completed" ? (run.conclusion === "success" ? "✅ Live" : "⚠️ " + run.conclusion) : "⏳ Building…") : "—";
      view.innerHTML =
        head("Dashboard", "Everything you edit here commits to <code>" + BRANCH + "</code> and publishes automatically.") +
        '<div class="banner info"><i class="fa-solid fa-circle-info"></i> After you save, GitHub rebuilds the site. Changes usually appear within a minute at <a href="' + SITE_URL + '" target="_blank" rel="noopener">' + SITE_URL.replace("https://", "") + "</a>.</div>" +
        '<div class="stat-grid">' +
          stat("Signed in as", "@" + esc(user.login)) +
          stat("Last deploy", runState) +
          stat("Last commit", esc(when)) +
        "</div>" +
        '<div class="card"><b>Last change</b><div style="margin-top:.5rem;color:var(--text-secondary);font-size:.9rem">' +
          (commit ? esc(commit.commit.message.split("\n")[0]) + '<br><span style="color:var(--text-muted)">' + esc((commit.author && commit.author.login) || commit.commit.author.name) + " · " + esc(when) + "</span>" : "No commits found.") +
        "</div></div>" +
        '<div class="card"><b>Quick edit</b><div class="chips" style="margin-top:.6rem">' +
          TABS.filter(function (t) { return ["profile", "news", "publications", "projects", "blog"].indexOf(t.id) >= 0; })
            .map(function (t) { return '<button class="btn btn-sm" data-jump="' + t.id + '"><i class="fa-solid ' + t.icon + '"></i> ' + t.label + "</button>"; }).join("") +
        "</div></div>";
      view.querySelectorAll("[data-jump]").forEach(function (b) { b.addEventListener("click", function () { go(b.dataset.jump); }); });
    });
  }
  function stat(k, v) { return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + "</div></div>"; }

  /* ============================== Profile ================================ */
  function viewProfile(view) {
    return getFile("_data/profile.yml").then(function (f) {
      var d = loadYaml(f.text) || {};
      view.innerHTML = head("Profile", "Your name, contact details, social links, and bio.", '<button class="btn btn-primary" id="save"><i class="fa-solid fa-check"></i> Save</button>') +
        '<div class="card">' +
          '<div class="grid-2">' +
            fld("Name", "name", d.name) + fld("Position", "position", d.position) +
            fld("Institution", "institution", d.institution) + fld("Location", "location", d.location) +
            fld("Email", "email", d.email, "email") + fld("GitHub username", "github", d.github) +
            fld("LinkedIn slug", "linkedin", d.linkedin) + fld("Google Scholar ID", "google_scholar", d.google_scholar) +
            fld("ORCID", "orcid", d.orcid) +
          "</div>" +
          txt("Bio (Markdown)", "bio", d.bio, "Shown as the intro paragraphs on the home page.") +
          txt('"Seeking" callout (Markdown)', "seeking", d.seeking, "The highlighted box under your bio.") +
        "</div>";
      bindSave(view.querySelector("#save"), function () {
        ["name", "position", "institution", "location", "email", "github", "linkedin", "google_scholar", "orcid", "bio", "seeking"].forEach(function (k) {
          d[k] = view.querySelector('[data-k="' + k + '"]').value;
        });
        return saveText("_data/profile.yml", dumpYaml(d), defaultCommitMsg("profile"), f.sha);
      }, "Profile");
    });
  }
  function fld(label, key, val, type) {
    return '<div class="field"><label class="lbl">' + esc(label) + '</label><input type="' + (type || "text") + '" data-k="' + key + '" value="' + esc(val) + '"></div>';
  }
  function txt(label, key, val, hint) {
    return '<div class="field"><label class="lbl">' + esc(label) + '</label><textarea data-k="' + key + '" rows="5">' + esc(val) + "</textarea>" + (hint ? '<div class="field-hint">' + hint + "</div>" : "") + "</div>";
  }

  /* =================== Generic ordered-list helpers ====================== */
  function moveItem(arr, i, dir) { var j = i + dir; if (j < 0 || j >= arr.length) return; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  function toolbar(i, n) {
    return '<div class="item-tools">' +
      '<button class="btn btn-sm btn-icon" data-up="' + i + '"' + (i === 0 ? " disabled" : "") + ' title="Move up"><i class="fa-solid fa-arrow-up"></i></button>' +
      '<button class="btn btn-sm btn-icon" data-down="' + i + '"' + (i === n - 1 ? " disabled" : "") + ' title="Move down"><i class="fa-solid fa-arrow-down"></i></button>' +
      '<button class="btn btn-sm btn-danger" data-del="' + i + '" title="Delete"><i class="fa-solid fa-trash"></i></button>' +
    "</div>";
  }
  // collect() MUST run before mutating so edits in the DOM aren't lost, then render().
  function wireListTools(view, arr, collect, render) {
    view.querySelectorAll("[data-up]").forEach(function (b) { b.onclick = function () { collect(); moveItem(arr, +b.dataset.up, -1); render(); }; });
    view.querySelectorAll("[data-down]").forEach(function (b) { b.onclick = function () { collect(); moveItem(arr, +b.dataset.down, 1); render(); }; });
    view.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () { collect(); arr.splice(+b.dataset.del, 1); render(); }; });
  }

  /* ============================= Interests =============================== */
  function viewInterests(view) {
    return getFile("_data/interests.yml").then(function (f) {
      var arr = loadYaml(f.text) || [];
      function collect() { view.querySelectorAll("[data-i]").forEach(function (inp) { arr[+inp.dataset.i] = inp.value; }); }
      function render() {
        view.innerHTML = head("Research Interests", "A simple ordered list shown on your About page.",
          '<button class="btn" id="add"><i class="fa-solid fa-plus"></i> Add</button><button class="btn btn-primary" id="save"><i class="fa-solid fa-check"></i> Save</button>') +
          (arr.length ? arr.map(function (v, i) {
            return '<div class="item"><div class="row-inline"><input type="text" data-i="' + i + '" value="' + esc(v) + '">' + toolbar(i, arr.length) + "</div></div>";
          }).join("") : '<div class="empty">No interests yet. Click “Add”.</div>');
        view.querySelector("#add").onclick = function () { collect(); arr.push("New interest"); render(); };
        wireListTools(view, arr, collect, render);
        bindSave(view.querySelector("#save"), function () { collect(); return saveText("_data/interests.yml", dumpYaml(arr), defaultCommitMsg("research interests"), f.sha); }, "Interests");
      }
      render();
    });
  }

  /* =============================== News ================================= */
  function viewNews(view) {
    return getFile("_data/news.yml").then(function (f) {
      var arr = loadYaml(f.text) || [];
      function collect() { view.querySelectorAll(".item").forEach(function (it, i) { arr[i] = { date: it.querySelector("[data-date]").value, text: it.querySelector("[data-text]").value }; }); }
      function render() {
        view.innerHTML = head("Recent News", 'Dated updates on your About page. Basic HTML like <code>&lt;strong&gt;</code> and <code>&lt;em&gt;</code> is allowed in the text.',
          '<button class="btn" id="add"><i class="fa-solid fa-plus"></i> Add</button><button class="btn btn-primary" id="save"><i class="fa-solid fa-check"></i> Save</button>') +
          (arr.length ? arr.map(function (n, i) {
            return '<div class="item"><div class="item-head"><span class="grip">#' + (i + 1) + "</span>" + toolbar(i, arr.length) + "</div>" +
              '<div class="field" style="margin-bottom:.6rem"><label class="lbl">Date label</label><input type="text" data-date value="' + esc(n.date) + '" style="max-width:200px"></div>' +
              '<div class="field" style="margin:0"><label class="lbl">Text</label><textarea data-text rows="2">' + esc(n.text) + "</textarea></div></div>";
          }).join("") : '<div class="empty">No news yet. Click “Add”.</div>');
        view.querySelector("#add").onclick = function () { collect(); arr.unshift({ date: new Date().getFullYear() + "", text: "" }); render(); };
        wireListTools(view, arr, collect, render);
        bindSave(view.querySelector("#save"), function () { collect(); return saveText("_data/news.yml", dumpYaml(arr), defaultCommitMsg("news"), f.sha); }, "News");
      }
      render();
    });
  }

  /* ============================= Projects =============================== */
  function viewProjects(view) {
    return getFile("_data/projects.yml").then(function (f) {
      var arr = loadYaml(f.text) || [];
      function collect() {
        view.querySelectorAll(".item").forEach(function (it, i) {
          arr[i] = {
            title: it.querySelector("[data-title]").value,
            icon: it.querySelector("[data-icon]").value,
            description: it.querySelector("[data-desc]").value,
            tags: it.querySelector("[data-tags]").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
            github: it.querySelector("[data-github]").value,
            demo: it.querySelector("[data-demo]").value
          };
        });
      }
      function render() {
        view.innerHTML = head("Projects", "Cards on your Projects page. Icon uses Font Awesome classes (e.g. <code>fa-solid fa-microscope</code>).",
          '<button class="btn" id="add"><i class="fa-solid fa-plus"></i> Add</button><button class="btn btn-primary" id="save"><i class="fa-solid fa-check"></i> Save</button>') +
          (arr.length ? arr.map(function (p, i) {
            return '<div class="item"><div class="item-head"><b>' + esc(p.title || "Untitled") + "</b>" + toolbar(i, arr.length) + "</div>" +
              '<div class="grid-2">' +
                '<div class="field"><label class="lbl">Title</label><input type="text" data-title value="' + esc(p.title) + '"></div>' +
                '<div class="field"><label class="lbl">Icon class</label><input type="text" data-icon value="' + esc(p.icon) + '"></div>' +
              "</div>" +
              '<div class="field"><label class="lbl">Description</label><textarea data-desc rows="2">' + esc(p.description) + "</textarea></div>" +
              '<div class="field"><label class="lbl">Tags (comma-separated)</label><input type="text" data-tags value="' + esc((p.tags || []).join(", ")) + '"></div>' +
              '<div class="grid-2">' +
                '<div class="field" style="margin:0"><label class="lbl">GitHub URL</label><input type="url" data-github value="' + esc(p.github) + '"></div>' +
                '<div class="field" style="margin:0"><label class="lbl">Live demo URL</label><input type="url" data-demo value="' + esc(p.demo) + '"></div>' +
              "</div></div>";
          }).join("") : '<div class="empty">No projects yet. Click “Add”.</div>');
        view.querySelector("#add").onclick = function () { collect(); arr.push({ title: "New project", icon: "fa-solid fa-code", description: "", tags: [], github: "", demo: "" }); render(); };
        wireListTools(view, arr, collect, render);
        bindSave(view.querySelector("#save"), function () { collect(); return saveText("_data/projects.yml", dumpYaml(arr), defaultCommitMsg("projects"), f.sha); }, "Projects");
      }
      render();
    });
  }

  /* =========================== Publications ============================= */
  var PUB_STATUS = [["accepted", "Accepted / Published"], ["under_review", "Under Review"], ["ongoing", "Ongoing"]];
  function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "pub"; }

  function viewPublications(view) {
    return getFile("_data/publications.yml").then(function (f) {
      var arr = loadYaml(f.text) || [];
      function collect() {
        view.querySelectorAll(".item").forEach(function (it, i) {
          var p = arr[i];
          p.title = it.querySelector("[data-title]").value;
          p.year = numOr(it.querySelector("[data-year]").value, p.year);
          p.venue = it.querySelector("[data-venue]").value;
          p.publisher = it.querySelector("[data-publisher]").value;
          p.quartile = it.querySelector("[data-quartile]").value;
          p.impact_factor = it.querySelector("[data-if]").value;
          p.status = it.querySelector("[data-status]").value;
          var type = it.querySelector("[data-type]").value;
          delete p.journal; delete p.conference;
          if (type === "journal") p.journal = true; else if (type === "conference") p.conference = true;
          p.authors = it.querySelector("[data-authors]").value.split("\n").map(function (line) { return line.trim(); }).filter(Boolean).map(function (line) {
            var me = /^\*/.test(line); return { name: line.replace(/^\*\s*/, ""), is_me: me };
          });
          p.links = { doi: it.querySelector("[data-doi]").value, pdf: it.querySelector("[data-pdf]").value, arxiv: it.querySelector("[data-arxiv]").value, code: it.querySelector("[data-code]").value };
        });
      }
      function render() {
        view.innerHTML = head("Publications", 'Grouped on your Publications page by status. In authors, prefix your own name with <code>*</code> to bold it.',
          '<button class="btn" id="add"><i class="fa-solid fa-plus"></i> Add</button><button class="btn btn-primary" id="save"><i class="fa-solid fa-check"></i> Save</button>') +
          (arr.length ? arr.map(function (p, i) {
            var type = p.journal ? "journal" : (p.conference ? "conference" : "");
            var authors = (p.authors || []).map(function (a) { return (a.is_me ? "*" : "") + a.name; }).join("\n");
            var links = p.links || {};
            return '<div class="item"><div class="item-head"><b>' + esc((p.title || "Untitled").slice(0, 60)) + "</b>" + toolbar(i, arr.length) + "</div>" +
              '<div class="field"><label class="lbl">Title</label><input type="text" data-title value="' + esc(p.title) + '"></div>' +
              '<div class="field"><label class="lbl">Authors (one per line, prefix yours with *)</label><textarea data-authors rows="2">' + esc(authors) + "</textarea></div>" +
              '<div class="grid-2">' +
                '<div class="field"><label class="lbl">Venue</label><input type="text" data-venue value="' + esc(p.venue) + '"></div>' +
                '<div class="field"><label class="lbl">Publisher</label><input type="text" data-publisher value="' + esc(p.publisher) + '"></div>' +
              "</div>" +
              '<div class="grid-2">' +
                '<div class="field"><label class="lbl">Year</label><input type="number" data-year value="' + esc(p.year) + '"></div>' +
                '<div class="field"><label class="lbl">Type</label><select data-type>' + opt("", "—", type) + opt("journal", "Journal", type) + opt("conference", "Conference", type) + "</select></div>" +
              "</div>" +
              '<div class="grid-2">' +
                '<div class="field"><label class="lbl">Quartile</label><input type="text" data-quartile value="' + esc(p.quartile) + '" placeholder="Q1"></div>' +
                '<div class="field"><label class="lbl">Impact factor</label><input type="text" data-if value="' + esc(p.impact_factor) + '"></div>' +
              "</div>" +
              '<div class="field"><label class="lbl">Status</label><select data-status>' + PUB_STATUS.map(function (s) { return opt(s[0], s[1], p.status); }).join("") + "</select></div>" +
              '<div class="grid-2">' +
                '<div class="field"><label class="lbl">DOI URL</label><input type="url" data-doi value="' + esc(links.doi) + '"></div>' +
                '<div class="field"><label class="lbl">PDF URL</label><input type="url" data-pdf value="' + esc(links.pdf) + '"></div>' +
              "</div>" +
              '<div class="grid-2">' +
                '<div class="field" style="margin:0"><label class="lbl">arXiv URL</label><input type="url" data-arxiv value="' + esc(links.arxiv) + '"></div>' +
                '<div class="field" style="margin:0"><label class="lbl">Code URL</label><input type="url" data-code value="' + esc(links.code) + '"></div>' +
              "</div></div>";
          }).join("") : '<div class="empty">No publications yet. Click “Add”.</div>');
        view.querySelector("#add").onclick = function () { collect(); arr.push({ id: "pub-" + (arr.length + 1), title: "New publication", authors: [{ name: user.name, is_me: true }], year: new Date().getFullYear(), venue: "", publisher: "", status: "ongoing", quartile: "", impact_factor: "", links: { doi: "", pdf: "", arxiv: "", code: "" } }); render(); };
        wireListTools(view, arr, collect, render);
        bindSave(view.querySelector("#save"), function () {
          collect();
          arr.forEach(function (p) { if (!p.id) p.id = slugify(p.title); });
          return saveText("_data/publications.yml", dumpYaml(arr), defaultCommitMsg("publications"), f.sha);
        }, "Publications");
      }
      render();
    });
  }
  function opt(v, label, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + ">" + esc(label) + "</option>"; }
  function numOr(v, dflt) { var n = parseInt(v, 10); return isNaN(n) ? dflt : n; }

  /* ================================ CV ================================== */
  function viewCV(view) {
    return getFile("_pages/cv.md").then(function (f) {
      var fm = splitFrontMatter(f.text);
      view.innerHTML = head("CV", "Edit the text on your CV page, and replace the downloadable PDF.",
        '<button class="btn btn-primary" id="save"><i class="fa-solid fa-check"></i> Save text</button>') +
        '<div class="card"><label class="lbl">CV page content (HTML + Markdown)</label>' +
          '<textarea id="cvbody" rows="18">' + esc(fm.body) + "</textarea>" +
          '<div class="field-hint">This is the body of <code>_pages/cv.md</code> (the PDF embed and the Summary / Education / Skills sections).</div></div>' +
        '<div class="card"><b><i class="fa-solid fa-file-pdf"></i> CV PDF</b>' +
          '<p style="color:var(--text-secondary);font-size:.88rem;margin:.4rem 0">Replaces <code>assets/pdf/resume_Md._Noman_Biswas_Sibly.pdf</code> — the file behind the Download button and preview.</p>' +
          uploadWidget("cvpdf", "application/pdf") + "</div>";
      bindSave(view.querySelector("#save"), function () {
        return saveText("_pages/cv.md", joinFrontMatter(fm.data, view.querySelector("#cvbody").value), defaultCommitMsg("CV text"), f.sha);
      }, "CV");
      wireUpload(view, "cvpdf", "assets/pdf/resume_Md._Noman_Biswas_Sibly.pdf", "CV PDF");
    });
  }

  /* =============================== Media ================================ */
  function viewMedia(view) {
    view.innerHTML = head("Media", "Replace your profile photo and CV PDF. New files keep the same name so nothing else needs changing.") +
      '<div class="card"><b><i class="fa-solid fa-user"></i> Profile photo</b>' +
        '<p style="color:var(--text-secondary);font-size:.88rem;margin:.4rem 0">Replaces <code>assets/img/profile_photo.jpg</code> (shown on the home page). A square image works best.</p>' +
        uploadWidget("photo", "image/*") + "</div>" +
      '<div class="card"><b><i class="fa-solid fa-file-pdf"></i> CV PDF</b>' +
        '<p style="color:var(--text-secondary);font-size:.88rem;margin:.4rem 0">Replaces <code>assets/pdf/resume_Md._Noman_Biswas_Sibly.pdf</code>.</p>' +
        uploadWidget("cvpdf2", "application/pdf") + "</div>";
    wireUpload(view, "photo", "assets/img/profile_photo.jpg", "Profile photo");
    wireUpload(view, "cvpdf2", "assets/pdf/resume_Md._Noman_Biswas_Sibly.pdf", "CV PDF");
    return Promise.resolve();
  }

  function uploadWidget(id, accept) {
    return '<div class="upload-box" id="box-' + id + '">' +
      '<div id="prev-' + id + '"></div>' +
      '<input type="file" id="file-' + id + '" accept="' + accept + '" style="margin-bottom:.6rem">' +
      '<div><button class="btn btn-primary" id="up-' + id + '" disabled><i class="fa-solid fa-upload"></i> Upload &amp; publish</button></div>' +
    "</div>";
  }
  function wireUpload(view, id, path, label) {
    var input = view.querySelector("#file-" + id), btn = view.querySelector("#up-" + id), prev = view.querySelector("#prev-" + id);
    var buffer = null;
    input.addEventListener("change", function () {
      var file = input.files[0]; buffer = null; prev.innerHTML = ""; btn.disabled = true;
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        buffer = reader.result; btn.disabled = false;
        if (file.type.indexOf("image") === 0) prev.innerHTML = '<img src="' + URL.createObjectURL(file) + '" alt="preview">';
        else prev.innerHTML = '<div style="color:var(--text-secondary);font-size:.85rem">' + esc(file.name) + " · " + Math.round(file.size / 1024) + " KB</div>";
      };
      reader.readAsArrayBuffer(file);
    });
    btn.addEventListener("click", function () {
      if (!buffer) return;
      var orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner spin"></i> Uploading…';
      saveBinary(path, bufToB64(buffer), defaultCommitMsg(label)).then(function () {
        toast("<b>" + label + " uploaded.</b> Live in ~1 min.", "success"); input.value = ""; prev.innerHTML = "";
      }).catch(function (e) { toast("Upload failed: " + esc(e.message || e), "error"); })
        .then(function () { btn.innerHTML = orig; btn.disabled = true; });
    });
  }

  /* =============================== Blog ================================= */
  function viewBlog(view) {
    return api(repoPath("/contents/_posts?ref=" + BRANCH)).catch(function (e) { if (e.status === 404) return []; throw e; }).then(function (list) {
      var posts = (Array.isArray(list) ? list : []).filter(function (x) { return /\.(md|markdown)$/.test(x.name); })
        .sort(function (a, b) { return a.name < b.name ? 1 : -1; });
      view.innerHTML = head("Blog", "Your posts in <code>_posts/</code>.", '<button class="btn btn-primary" id="new"><i class="fa-solid fa-plus"></i> New post</button>') +
        (posts.length ? posts.map(function (p) {
          return '<div class="item"><div class="item-head"><div><b>' + esc(prettyPost(p.name)) + '</b><div style="color:var(--text-muted);font-size:.78rem">' + esc(p.name) + "</div></div>" +
            '<div class="item-tools"><button class="btn btn-sm" data-edit="' + esc(p.path) + '"><i class="fa-solid fa-pen"></i> Edit</button>' +
            '<button class="btn btn-sm btn-danger" data-delpost="' + esc(p.path) + '" data-sha="' + esc(p.sha) + '"><i class="fa-solid fa-trash"></i></button></div></div></div>';
        }).join("") : '<div class="empty">No posts yet. Click “New post”.</div>');
      view.querySelector("#new").onclick = function () { editPost(view, null); };
      view.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { editPost(view, b.dataset.edit); }; });
      view.querySelectorAll("[data-delpost]").forEach(function (b) {
        b.onclick = function () {
          if (!confirm("Delete this post? This commits a deletion to your site.")) return;
          deleteFile(b.dataset.delpost, b.dataset.sha, defaultCommitMsg("delete post")).then(function () { toast("Post deleted.", "success"); go("blog"); })
            .catch(function (e) { toast("Delete failed: " + esc(e.message || e), "error"); });
        };
      });
    });
  }
  function prettyPost(name) { var m = /^\d{4}-\d{2}-\d{2}-(.+)\.(md|markdown)$/.exec(name); return m ? m[1].replace(/-/g, " ") : name; }

  function editPost(view, path) {
    var isNew = !path;
    var load = isNew ? Promise.resolve({ data: { layout: "post", title: "", date: todayStr(), categories: [], excerpt: "" }, body: "", sha: null })
                     : getFile(path).then(function (f) { var fm = splitFrontMatter(f.text); return { data: fm.data, body: fm.body, sha: f.sha }; });
    load.then(function (post) {
      var d = post.data || {};
      view.innerHTML = head(isNew ? "New post" : "Edit post", "", '<button class="btn" id="back"><i class="fa-solid fa-arrow-left"></i> Back</button><button class="btn btn-primary" id="save"><i class="fa-solid fa-check"></i> ' + (isNew ? "Publish" : "Save") + "</button>") +
        '<div class="card">' +
          '<div class="grid-2">' +
            '<div class="field"><label class="lbl">Title</label><input type="text" id="p-title" value="' + esc(d.title) + '"></div>' +
            '<div class="field"><label class="lbl">Date</label><input type="date" id="p-date" value="' + esc(dateOnly(d.date)) + '"></div>' +
          "</div>" +
          '<div class="field"><label class="lbl">Categories (comma-separated)</label><input type="text" id="p-cats" value="' + esc([].concat(d.categories || []).join(", ")) + '"></div>' +
          '<div class="field"><label class="lbl">Excerpt</label><textarea id="p-exc" rows="2">' + esc(d.excerpt) + "</textarea></div>" +
          '<div class="field" style="margin:0"><label class="lbl">Body (Markdown)</label><textarea id="p-body" rows="14">' + esc(post.body) + "</textarea></div>" +
        "</div>";
      view.querySelector("#back").onclick = function () { go("blog"); };
      bindSave(view.querySelector("#save"), function () {
        var title = view.querySelector("#p-title").value.trim();
        var date = view.querySelector("#p-date").value || todayStr();
        if (!title) throw new Error("Title is required.");
        var data = Object.assign({}, d, {
          layout: d.layout || "post", title: title, date: date,
          categories: view.querySelector("#p-cats").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
          excerpt: view.querySelector("#p-exc").value
        });
        var text = joinFrontMatter(data, view.querySelector("#p-body").value);
        var target = path || ("_posts/" + date + "-" + slugify(title) + ".md");
        return saveText(target, text, defaultCommitMsg(isNew ? "new post" : "edit post"), post.sha).then(function () { setTimeout(function () { go("blog"); }, 400); });
      }, "Post");
    });
  }
  function todayStr() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateOnly(s) { if (!s) return todayStr(); var m = /^(\d{4}-\d{2}-\d{2})/.exec(String(s)); return m ? m[1] : todayStr(); }

  /* ============================= Settings =============================== */
  function viewSettings(view) {
    var storage = localStorage.getItem(LS.tokenEnc) ? "Encrypted with passphrase" : (localStorage.getItem(LS.tokenPlain) ? "Saved in this browser" : "This session only");
    view.innerHTML = head("Settings", "Token, commit messages, and appearance.") +
      '<div class="card"><b>Commit messages</b>' +
        '<div class="field" style="margin-top:.6rem"><label class="lbl">Default template</label><input type="text" id="msg" value="' + esc(localStorage.getItem(LS.commitMsg) || "admin: update {what}") + '"><div class="field-hint"><code>{what}</code> is replaced with what you edited (e.g. “profile”).</div></div>' +
        '<button class="btn btn-primary" id="saveMsg"><i class="fa-solid fa-check"></i> Save template</button></div>' +
      '<div class="card"><b>Token &amp; security</b>' +
        '<p style="color:var(--text-secondary);font-size:.88rem;margin:.5rem 0">Storage: <b>' + storage + "</b>. The token is what lets this page edit your site — keep it private and give it a short expiry.</p>" +
        '<div class="foot-actions" style="flex-wrap:wrap;gap:.5rem">' +
          '<button class="btn" id="lock2"><i class="fa-solid fa-lock"></i> Lock now</button>' +
          '<button class="btn btn-danger" id="signout"><i class="fa-solid fa-right-from-bracket"></i> Sign out &amp; forget token</button>' +
          '<a class="btn" href="https://github.com/settings/tokens" target="_blank" rel="noopener"><i class="fa-brands fa-github"></i> Manage tokens on GitHub</a>' +
        "</div></div>" +
      '<div class="card"><b>Appearance</b><div style="margin-top:.6rem"><button class="btn" id="theme2"><i class="fa-solid fa-circle-half-stroke"></i> Toggle light / dark</button></div></div>';
    view.querySelector("#saveMsg").onclick = function () { localStorage.setItem(LS.commitMsg, view.querySelector("#msg").value); toast("Saved.", "success"); };
    view.querySelector("#lock2").onclick = lock;
    view.querySelector("#theme2").onclick = toggleTheme;
    view.querySelector("#signout").onclick = function () {
      if (!confirm("Forget the token from this browser and sign out?")) return;
      localStorage.removeItem(LS.tokenPlain); localStorage.removeItem(LS.tokenEnc); sessionStorage.removeItem(LS.tokenPlain);
      token = null; user = null; renderLogin(null);
    };
    return Promise.resolve();
  }

  /* ============================== Misc UI =============================== */
  function lock() {
    token = null; user = null;
    var enc = localStorage.getItem(LS.tokenEnc);
    if (enc) { renderLogin(enc); }
    else { renderLogin(null); }
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    var next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(LS.theme, next); } catch (e) {}
  }

  /* ============================== Bootstrap ============================== */
  function boot() {
    if (typeof jsyaml === "undefined") { app.innerHTML = '<div class="boot">Could not load the YAML library (offline?). Please refresh.</div>'; return; }
    var sessionTok = sessionStorage.getItem(LS.tokenPlain);
    var plain = localStorage.getItem(LS.tokenPlain);
    var enc = localStorage.getItem(LS.tokenEnc);
    if (sessionTok || plain) {
      validateToken(sessionTok || plain).then(enterApp).catch(function () {
        // stale/expired token — clear and ask again
        sessionStorage.removeItem(LS.tokenPlain);
        if (plain) localStorage.removeItem(LS.tokenPlain);
        renderLogin(enc || null);
      });
    } else if (enc) {
      renderLogin(enc);
    } else {
      renderLogin(null);
    }
  }

  boot();
})();

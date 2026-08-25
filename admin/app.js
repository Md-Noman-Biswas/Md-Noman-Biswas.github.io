/* ============================================================================
 * Admin panel for Md-Noman-Biswas.github.io
 * Pure static SPA. Reads/writes content files via the GitHub REST API and
 * commits to `main`, which triggers the existing Actions build (~1 min to live).
 * No backend, no third-party service. The GitHub token is the only credential.
 * Icons are inline SVG so they never depend on an external font/CDN.
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
  var dirty = false;         // unsaved changes in the current tab

  var app = document.getElementById("app");

  /* ------------------------------- Icons ---------------------------------- */
  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    user:      '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    bulb:      '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.1 14c.2-1 .6-1.7 1.4-2.5A4.6 4.6 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.8.8 1.2 1.5 1.4 2.5"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    book:      '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    folder:    '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
    file:      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    pen:       '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
    image:     '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    gear:      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7.26 19.4l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3 14.6H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 7.26l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9.4 3H10a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 21 10.6V11a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
    lock:      '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    moon:      '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    external:  '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/>',
    menu:      '<path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/>',
    plus:      '<path d="M12 5v14"/><path d="M5 12h14"/>',
    check:     '<path d="M20 6 9 17l-5-5"/>',
    up:        '<path d="m18 15-6-6-6 6"/>',
    down:      '<path d="m6 9 6 6 6-6"/>',
    trash:     '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    back:      '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    upload:    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    info:      '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    alert:     '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    help:      '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    github:    '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.1-1.2-.3-2.5-1-3.5.3-1.2.3-2.4 0-3.5 0 0-1 0-3 1.5-2.6-.5-5.4-.5-8 0C6 2 5 2 5 2c-.3 1.1-.3 2.3 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.4.5-.7 1-.9 1.6-.2.6-.2 1.3-.1 1.9v4"/><path d="M9 18c-4.5 2-5-2-7-2"/>',
    signout:   '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    spinner:   '<circle cx="12" cy="12" r="9" stroke-opacity=".25"/><path d="M21 12a9 9 0 0 0-9-9"/>',
    inbox:     '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>'
  };
  function ic(name, cls) {
    return '<svg class="ic ' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  }

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
    setTimeout(function () {
      t.style.transition = "opacity .3s"; t.style.opacity = "0";
      setTimeout(function () { t.remove(); }, 300);
    }, type === "error" ? 6000 : 3500);
  }

  function setDirty(v) {
    dirty = v;
    var p = document.querySelector(".pill-dirty");
    if (p) p.hidden = !v;
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
    return api(repoPath("/contents/" + encodePath(path)), {
      method: "DELETE",
      body: JSON.stringify({ message: message, sha: sha, branch: BRANCH })
    });
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
        if (!repo.permissions || !repo.permissions.push) {
          throw new Error("This token cannot write to the repository. Grant it Contents: Read and write.");
        }
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
        "<h1>" + (isUnlock ? "Unlock admin" : "Admin sign in") + "</h1>" +
        '<p class="auth-sub">' + (isUnlock
          ? "Enter your passphrase to decrypt your saved token."
          : "Paste a GitHub token with write access to this repository.") + "</p>" +
        (isUnlock
          ? '<div class="field"><label class="lbl">Passphrase</label><input type="password" id="pass" autofocus></div>'
          : ('<div class="field"><label class="lbl">GitHub token</label><input type="password" id="tok" placeholder="github_pat_… or ghp_…" autofocus></div>' +
             '<div class="field"><label class="lbl">Keep me signed in</label>' +
               '<div class="radio-row">' +
                 '<label><input type="radio" name="store" value="plain" checked><span>On this device <small>Saved in this browser. Convenient on your own machine.</small></span></label>' +
                 '<label><input type="radio" name="store" value="enc"><span>Encrypted with a passphrase <small>Safer on shared devices. You unlock with a passphrase each visit.</small></span></label>' +
                 '<label><input type="radio" name="store" value="session"><span>This session only <small>Forgotten when you close the tab.</small></span></label>' +
               "</div>" +
             "</div>" +
             '<div class="field" id="passWrap" style="display:none"><label class="lbl">Passphrase</label><input type="password" id="encpass"><div class="field-hint">Encrypts the token in this browser. There is no recovery — remember it.</div></div>' +
             helpBlock())) +
        '<button class="btn btn-primary" id="go" style="width:100%;margin-top:.4rem">' + (isUnlock ? "Unlock" : "Sign in") + "</button>" +
        '<div id="err"></div>' +
        (isUnlock ? '<div style="margin-top:1rem;text-align:center"><a href="#" id="forget">Use a different token</a></div>' : "") +
      "</div></div>"
    );
    app.appendChild(card);

    var errEl = card.querySelector("#err");
    function fail(m) { errEl.textContent = m; }

    if (!isUnlock) {
      var passWrap = card.querySelector("#passWrap");
      card.querySelectorAll("input[name=store]").forEach(function (r) {
        r.addEventListener("change", function () {
          passWrap.style.display = (card.querySelector("input[name=store]:checked").value === "enc") ? "block" : "none";
        });
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
        var mode = card.querySelector("input[name=store]:checked").value;
        validateToken(tok).then(function () {
          if (mode === "plain") { localStorage.setItem(LS.tokenPlain, tok); localStorage.removeItem(LS.tokenEnc); return enterApp(); }
          if (mode === "session") {
            sessionStorage.setItem(LS.tokenPlain, tok);
            localStorage.removeItem(LS.tokenPlain); localStorage.removeItem(LS.tokenEnc);
            return enterApp();
          }
          var pw = card.querySelector("#encpass").value;
          if (!pw) { fail("Enter a passphrase to encrypt the token."); done(); return; }
          return encryptToken(tok, pw).then(function (blob) {
            localStorage.setItem(LS.tokenEnc, blob); localStorage.removeItem(LS.tokenPlain); enterApp();
          });
        }).catch(function (e) { fail(e.message || "Sign in failed."); done(); });
      }
    });
    card.addEventListener("keydown", function (e) { if (e.key === "Enter") card.querySelector("#go").click(); });
  }

  function helpBlock() {
    return '<details class="help"><summary>' + ic("help") + " How do I create a token?</summary><ol>" +
      '<li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Fine-grained tokens → Generate new</a>.</li>' +
      "<li>Set an <b>expiry</b> (e.g. 90 days). Under <b>Repository access</b> choose <b>Only select repositories</b> → <code>" + REPO_NAME + "</code>.</li>" +
      "<li>Under <b>Permissions → Repository</b>, set <b>Contents</b> to <b>Read and write</b>. Leave everything else off.</li>" +
      "<li>Generate, copy the token, and paste it above. You can revoke it anytime from the same page.</li>" +
      "</ol></details>";
  }

  /* ============================== App shell =============================== */
  var TABS = [
    { id: "dashboard",    label: "Dashboard",          icon: "dashboard" },
    { id: "profile",      label: "Profile",            icon: "user" },
    { id: "interests",    label: "Research Interests", icon: "bulb" },
    { id: "news",         label: "Recent News",        icon: "megaphone" },
    { id: "publications", label: "Publications",       icon: "book" },
    { id: "projects",     label: "Projects",           icon: "folder" },
    { id: "cv",           label: "CV",                 icon: "file" },
    { id: "blog",         label: "Blog",               icon: "pen" },
    { id: "media",        label: "Media",              icon: "image" },
    { id: "settings",     label: "Settings",           icon: "gear" }
  ];

  function enterApp() {
    app.innerHTML = "";
    var shell = el(
      '<div class="admin-shell">' +
        '<div class="backdrop" id="backdrop"></div>' +
        '<aside class="sidebar" id="sidebar">' +
          '<div class="brand"><span>🛠️</span><span>Admin<small>' + esc(REPO_NAME) + "</small></span></div>" +
          '<nav class="nav" id="nav"></nav>' +
          '<div class="sidebar-foot">' +
            '<div class="who"><img src="' + esc(user.avatar_url) + '" alt=""><div><b>' + esc(user.name) + "</b><span>@" + esc(user.login) + "</span></div></div>" +
            '<div class="foot-actions">' +
              '<button class="btn btn-sm" id="lockBtn" title="Lock the panel">' + ic("lock") + " Lock</button>" +
              '<button class="btn btn-sm btn-icon" id="themeBtn" title="Light / dark">' + ic("moon") + "</button>" +
              '<a class="btn btn-sm btn-icon" href="' + SITE_URL + '" target="_blank" rel="noopener" title="View live site">' + ic("external") + "</a>" +
            "</div>" +
          "</div>" +
        "</aside>" +
        '<main class="content">' +
          '<div class="topbar"><button class="btn btn-icon menu-btn" id="menuBtn">' + ic("menu") + "</button><b>Admin</b></div>" +
          '<div id="view"></div>' +
        "</main>" +
      "</div>"
    );
    app.appendChild(shell);

    var nav = shell.querySelector("#nav");
    TABS.forEach(function (t) {
      var b = el('<button data-tab="' + t.id + '">' + ic(t.icon, "ic-lg") + "<span>" + t.label + "</span></button>");
      b.addEventListener("click", function () { closeMenu(); go(t.id); });
      nav.appendChild(b);
    });

    shell.querySelector("#lockBtn").addEventListener("click", lock);
    shell.querySelector("#themeBtn").addEventListener("click", toggleTheme);

    var sb = shell.querySelector("#sidebar"), bd = shell.querySelector("#backdrop");
    function closeMenu() { sb.classList.remove("open"); bd.classList.remove("show"); }
    shell.querySelector("#menuBtn").addEventListener("click", function () { sb.classList.add("open"); bd.classList.add("show"); });
    bd.addEventListener("click", closeMenu);

    // Any edit in the content area marks the tab dirty.
    shell.querySelector("#view").addEventListener("input", function () { setDirty(true); });

    go(currentTab);
  }

  function go(tab) {
    currentTab = tab;
    dirty = false;
    document.querySelectorAll(".nav button").forEach(function (b) { b.classList.toggle("active", b.dataset.tab === tab); });
    var view = document.getElementById("view");
    view.innerHTML = '<div class="loading">' + ic("spinner", "spin") + " Loading…</div>";
    var fn = ({
      dashboard: viewDashboard, profile: viewProfile, interests: viewInterests, news: viewNews,
      publications: viewPublications, projects: viewProjects, cv: viewCV, blog: viewBlog,
      media: viewMedia, settings: viewSettings
    })[tab];
    Promise.resolve().then(function () { return fn(view); }).catch(function (e) {
      view.innerHTML = '<div class="empty">' + ic("alert") + "<p>" + esc(e.message || "Failed to load.") + "</p></div>";
    });
  }

  function head(title, sub, actionsHtml) {
    return '<div class="page-head"><div><h2>' + esc(title) + "</h2>" + (sub ? "<p>" + sub + "</p>" : "") + "</div>" +
      '<div class="head-actions"><span class="pill-dirty" hidden>Unsaved changes</span>' + (actionsHtml || "") + "</div></div>";
  }
  function addBtn(label) { return '<button class="btn" id="add">' + ic("plus") + " " + (label || "Add") + "</button>"; }
  function saveBtn(label) { return '<button class="btn btn-primary" id="save">' + ic("check") + " " + (label || "Save") + "</button>"; }

  // Wire a Save button with spinner + toast + rebuild note.
  function bindSave(btn, fn, what) {
    btn.addEventListener("click", function () {
      var orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = ic("spinner", "spin") + " Saving…";
      Promise.resolve().then(fn).then(function () {
        setDirty(false);
        toast("<b>Saved.</b> " + (what || "Changes") + " will be live in ~1 min.", "success");
      }).catch(function (e) {
        toast("Save failed: " + esc(e.message || e), "error");
      }).then(function () {
        btn.disabled = false; btn.innerHTML = orig;
      });
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
      var runState = run
        ? (run.status === "completed" ? (run.conclusion === "success" ? "Live" : run.conclusion) : "Building…")
        : "—";

      view.innerHTML =
        head("Dashboard", "Everything you edit here commits to <code>" + BRANCH + "</code> and publishes automatically.") +
        '<div class="banner">' + ic("info") + "<div>After you save, GitHub rebuilds the site. Changes usually appear within a minute at " +
          '<a href="' + SITE_URL + '" target="_blank" rel="noopener">' + SITE_URL.replace("https://", "") + "</a>.</div></div>" +
        '<div class="stat-grid">' +
          stat("Signed in as", "@" + esc(user.login)) +
          stat("Last deploy", esc(runState)) +
          stat("Last commit", esc(when)) +
        "</div>" +
        '<div class="card"><b>' + ic("info") + "Last change</b>" +
          '<div style="margin-top:.6rem;color:var(--text-2);font-size:.9rem">' +
          (commit
            ? esc(commit.commit.message.split("\n")[0]) +
              '<br><span style="color:var(--muted)">' + esc((commit.author && commit.author.login) || commit.commit.author.name) + " · " + esc(when) + "</span>"
            : "No commits found.") +
          "</div></div>" +
        '<div class="card"><b>Quick edit</b><div class="chips" style="margin-top:.7rem">' +
          TABS.filter(function (t) { return ["profile", "news", "publications", "projects", "blog"].indexOf(t.id) >= 0; })
            .map(function (t) { return '<button class="btn btn-sm" data-jump="' + t.id + '">' + ic(t.icon) + " " + t.label + "</button>"; }).join("") +
        "</div></div>";

      view.querySelectorAll("[data-jump]").forEach(function (b) {
        b.addEventListener("click", function () { go(b.dataset.jump); });
      });
    });
  }
  function stat(k, v) { return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + "</div></div>"; }

  /* ============================== Profile ================================ */
  function viewProfile(view) {
    return getFile("_data/profile.yml").then(function (f) {
      var d = loadYaml(f.text) || {};
      view.innerHTML = head("Profile", "Your name, contact details, social links, and bio.", saveBtn()) +
        '<div class="card">' +
          '<div class="grid-2">' +
            fld("Name", "name", d.name) + fld("Position", "position", d.position) +
            fld("Institution", "institution", d.institution) + fld("Location", "location", d.location) +
            fld("Email", "email", d.email, "email") + fld("GitHub username", "github", d.github) +
            fld("LinkedIn slug", "linkedin", d.linkedin) + fld("Google Scholar ID", "google_scholar", d.google_scholar) +
            fld("ORCID", "orcid", d.orcid) +
          "</div>" +
        "</div>" +
        '<div class="card">' +
          txt("Bio (Markdown)", "bio", d.bio, "The intro paragraphs on your home page.") +
          txt('"Seeking" callout (Markdown)', "seeking", d.seeking, "The highlighted box under your bio.") +
        "</div>";
      bindSave(view.querySelector("#save"), function () {
        ["name", "position", "institution", "location", "email", "github", "linkedin", "google_scholar", "orcid", "bio", "seeking"]
          .forEach(function (k) { d[k] = view.querySelector('[data-k="' + k + '"]').value; });
        return saveText("_data/profile.yml", dumpYaml(d), defaultCommitMsg("profile"), f.sha);
      }, "Profile");
    });
  }
  function fld(label, key, val, type) {
    return '<div class="field"><label class="lbl">' + esc(label) + '</label><input type="' + (type || "text") + '" data-k="' + key + '" value="' + esc(val) + '"></div>';
  }
  function txt(label, key, val, hint) {
    return '<div class="field"><label class="lbl">' + esc(label) + '</label><textarea data-k="' + key + '" rows="5">' + esc(val) + "</textarea>" +
      (hint ? '<div class="field-hint">' + hint + "</div>" : "") + "</div>";
  }

  /* =================== Generic ordered-list helpers ====================== */
  function moveItem(arr, i, dir) {
    var j = i + dir;
    if (j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  function toolbar(i, n) {
    return '<div class="item-tools">' +
      '<button class="btn btn-sm btn-icon" data-up="' + i + '"' + (i === 0 ? " disabled" : "") + ' title="Move up" aria-label="Move up">' + ic("up") + "</button>" +
      '<button class="btn btn-sm btn-icon" data-down="' + i + '"' + (i === n - 1 ? " disabled" : "") + ' title="Move down" aria-label="Move down">' + ic("down") + "</button>" +
      '<button class="btn btn-sm btn-danger" data-del="' + i + '" title="Delete this entry">' + ic("trash") + " Delete</button>" +
    "</div>";
  }
  // collect() MUST run before mutating so in-progress edits aren't lost, then render().
  function wireListTools(view, arr, collect, render) {
    view.querySelectorAll("[data-up]").forEach(function (b) {
      b.onclick = function () { collect(); moveItem(arr, +b.dataset.up, -1); setDirty(true); render(); };
    });
    view.querySelectorAll("[data-down]").forEach(function (b) {
      b.onclick = function () { collect(); moveItem(arr, +b.dataset.down, 1); setDirty(true); render(); };
    });
    view.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = function () {
        if (!confirm("Remove this entry?\n\nIt disappears from the site once you click Save.")) return;
        collect(); arr.splice(+b.dataset.del, 1); setDirty(true); render();
      };
    });
  }
  function emptyState(msg) { return '<div class="empty">' + ic("inbox") + "<p>" + msg + "</p></div>"; }

  /* ============================= Interests =============================== */
  function viewInterests(view) {
    return getFile("_data/interests.yml").then(function (f) {
      var arr = loadYaml(f.text) || [];
      function collect() {
        view.querySelectorAll("[data-i]").forEach(function (inp) { arr[+inp.dataset.i] = inp.value; });
      }
      function render() {
        view.innerHTML = head("Research Interests", "The list shown on your About page.", addBtn() + saveBtn()) +
          (arr.length ? arr.map(function (v, i) {
            return '<div class="item"><div class="row-inline">' +
              '<span class="grip">' + (i + 1) + "</span>" +
              '<input type="text" data-i="' + i + '" value="' + esc(v) + '">' +
              toolbar(i, arr.length) + "</div></div>";
          }).join("") : emptyState("No interests yet. Click <b>Add</b> to create one."));
        view.querySelector("#add").onclick = function () { collect(); arr.push("New interest"); setDirty(true); render(); };
        wireListTools(view, arr, collect, render);
        bindSave(view.querySelector("#save"), function () {
          collect();
          return saveText("_data/interests.yml", dumpYaml(arr), defaultCommitMsg("research interests"), f.sha);
        }, "Interests");
      }
      render();
    });
  }

  /* =============================== News ================================= */
  function viewNews(view) {
    return getFile("_data/news.yml").then(function (f) {
      var arr = loadYaml(f.text) || [];
      function collect() {
        view.querySelectorAll(".item").forEach(function (it, i) {
          arr[i] = { date: it.querySelector("[data-date]").value, text: it.querySelector("[data-text]").value };
        });
      }
      function render() {
        view.innerHTML = head("Recent News",
          "Dated updates on your About page. Basic HTML like <code>&lt;strong&gt;</code> and <code>&lt;em&gt;</code> is allowed.",
          addBtn() + saveBtn()) +
          (arr.length ? arr.map(function (n, i) {
            return '<div class="item"><div class="item-head"><span class="grip">' + (i + 1) + "</span>" + toolbar(i, arr.length) + "</div>" +
              '<div class="field"><label class="lbl">Date label</label><input type="text" data-date value="' + esc(n.date) + '" style="max-width:220px"></div>' +
              '<div class="field"><label class="lbl">Text</label><textarea data-text rows="3">' + esc(n.text) + "</textarea></div></div>";
          }).join("") : emptyState("No news yet. Click <b>Add</b> to post an update."));
        view.querySelector("#add").onclick = function () {
          collect(); arr.unshift({ date: new Date().getFullYear() + "", text: "" }); setDirty(true); render();
        };
        wireListTools(view, arr, collect, render);
        bindSave(view.querySelector("#save"), function () {
          collect();
          return saveText("_data/news.yml", dumpYaml(arr), defaultCommitMsg("news"), f.sha);
        }, "News");
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
        view.innerHTML = head("Projects", "Cards on your Projects page.", addBtn() + saveBtn()) +
          (arr.length ? arr.map(function (p, i) {
            return '<div class="item"><div class="item-head"><b>' + esc(p.title || "Untitled") + "</b>" + toolbar(i, arr.length) + "</div>" +
              '<div class="grid-2">' +
                '<div class="field"><label class="lbl">Title</label><input type="text" data-title value="' + esc(p.title) + '"></div>' +
                '<div class="field"><label class="lbl">Icon class</label><input type="text" data-icon value="' + esc(p.icon) + '">' +
                  '<div class="field-hint">Font Awesome class, e.g. <code>fa-solid fa-microscope</code>.</div></div>' +
              "</div>" +
              '<div class="field"><label class="lbl">Description</label><textarea data-desc rows="3">' + esc(p.description) + "</textarea></div>" +
              '<div class="field"><label class="lbl">Tags</label><input type="text" data-tags value="' + esc((p.tags || []).join(", ")) + '">' +
                '<div class="field-hint">Comma-separated.</div></div>' +
              '<div class="grid-2">' +
                '<div class="field"><label class="lbl">GitHub URL</label><input type="url" data-github value="' + esc(p.github) + '"></div>' +
                '<div class="field"><label class="lbl">Live demo URL</label><input type="url" data-demo value="' + esc(p.demo) + '"></div>' +
              "</div></div>";
          }).join("") : emptyState("No projects yet. Click <b>Add</b> to create one."));
        view.querySelector("#add").onclick = function () {
          collect();
          arr.push({ title: "New project", icon: "fa-solid fa-code", description: "", tags: [], github: "", demo: "" });
          setDirty(true); render();
        };
        wireListTools(view, arr, collect, render);
        bindSave(view.querySelector("#save"), function () {
          collect();
          return saveText("_data/projects.yml", dumpYaml(arr), defaultCommitMsg("projects"), f.sha);
        }, "Projects");
      }
      render();
    });
  }

  /* =========================== Publications ============================= */
  var PUB_STATUS = [["published", "Published"], ["accepted", "Accepted"], ["under_review", "Under Review"],
                    ["in_preparation", "In Preparation"], ["ongoing", "Ongoing"]];
  var PUB_ROLE = [["", "—"], ["First author", "First author"], ["Co-author", "Co-author"]];
  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "pub";
  }

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
          p.role = it.querySelector("[data-role]").value;
          var type = it.querySelector("[data-type]").value;
          delete p.journal; delete p.conference;
          if (type === "journal") p.journal = true;
          else if (type === "conference") p.conference = true;
          p.authors = it.querySelector("[data-authors]").value.split("\n")
            .map(function (line) { return line.trim(); }).filter(Boolean)
            .map(function (line) {
              var me = /^\*/.test(line);
              return { name: line.replace(/^\*\s*/, ""), is_me: me };
            });
          p.links = {
            doi: it.querySelector("[data-doi]").value,
            pdf: it.querySelector("[data-pdf]").value,
            arxiv: it.querySelector("[data-arxiv]").value,
            code: it.querySelector("[data-code]").value
          };
        });
      }
      function render() {
        view.innerHTML = head("Publications",
          "Grouped by status on your Publications page. In authors, prefix your own name with <code>*</code> to bold it.",
          addBtn() + saveBtn()) +
          (arr.length ? arr.map(function (p, i) {
            var type = p.journal ? "journal" : (p.conference ? "conference" : "");
            var authors = (p.authors || []).map(function (a) { return (a.is_me ? "*" : "") + a.name; }).join("\n");
            var links = p.links || {};
            return '<div class="item"><div class="item-head"><b>' + esc((p.title || "Untitled").slice(0, 70)) + "</b>" + toolbar(i, arr.length) + "</div>" +
              '<div class="field"><label class="lbl">Title</label><input type="text" data-title value="' + esc(p.title) + '"></div>' +
              '<div class="field"><label class="lbl">Authors</label><textarea data-authors rows="3">' + esc(authors) + "</textarea>" +
                '<div class="field-hint">One per line. Prefix yours with <code>*</code> to bold it on the site.</div></div>' +
              '<div class="grid-2">' +
                '<div class="field"><label class="lbl">Venue</label><input type="text" data-venue value="' + esc(p.venue) + '"></div>' +
                '<div class="field"><label class="lbl">Publisher</label><input type="text" data-publisher value="' + esc(p.publisher) + '"></div>' +
                '<div class="field"><label class="lbl">Year</label><input type="number" data-year value="' + esc(p.year) + '"></div>' +
                '<div class="field"><label class="lbl">Type</label><select data-type>' +
                  opt("", "—", type) + opt("journal", "Journal", type) + opt("conference", "Conference", type) + "</select></div>" +
                '<div class="field"><label class="lbl">Quartile</label><input type="text" data-quartile value="' + esc(p.quartile) + '" placeholder="Q1"></div>' +
                '<div class="field"><label class="lbl">Impact factor</label><input type="text" data-if value="' + esc(p.impact_factor) + '"></div>' +
              "</div>" +
              '<div class="grid-2">' +
                '<div class="field"><label class="lbl">Status</label><select data-status>' +
                  PUB_STATUS.map(function (s) { return opt(s[0], s[1], p.status); }).join("") + "</select></div>" +
                '<div class="field"><label class="lbl">Your role</label><select data-role>' +
                  PUB_ROLE.map(function (r) { return opt(r[0], r[1], p.role || ""); }).join("") + "</select></div>" +
              "</div>" +
              '<div class="grid-2">' +
                '<div class="field"><label class="lbl">DOI URL</label><input type="url" data-doi value="' + esc(links.doi) + '"></div>' +
                '<div class="field"><label class="lbl">PDF URL</label><input type="url" data-pdf value="' + esc(links.pdf) + '"></div>' +
                '<div class="field"><label class="lbl">arXiv URL</label><input type="url" data-arxiv value="' + esc(links.arxiv) + '"></div>' +
                '<div class="field"><label class="lbl">Code URL</label><input type="url" data-code value="' + esc(links.code) + '"></div>' +
              "</div></div>";
          }).join("") : emptyState("No publications yet. Click <b>Add</b> to create one."));
        view.querySelector("#add").onclick = function () {
          collect();
          arr.push({
            id: "pub-" + (arr.length + 1), title: "New publication",
            authors: [{ name: user.name, is_me: true }], year: new Date().getFullYear(),
            venue: "", publisher: "", status: "ongoing", role: "", quartile: "", impact_factor: "",
            links: { doi: "", pdf: "", arxiv: "", code: "" }
          });
          setDirty(true); render();
        };
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
  function opt(v, label, cur) {
    return '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + ">" + esc(label) + "</option>";
  }
  function numOr(v, dflt) { var n = parseInt(v, 10); return isNaN(n) ? dflt : n; }

  /* ================================ CV ================================== */
  var CV_PDF = "assets/pdf/Md_Noman_Biswas_Sibly_CV.pdf";
  var PHOTO  = "assets/img/profile_photo.jpg";

  function viewCV(view) {
    return getFile("_pages/cv.md").then(function (f) {
      var fm = splitFrontMatter(f.text);
      view.innerHTML = head("CV", "Edit the text on your CV page, and replace the downloadable PDF.", saveBtn("Save text")) +
        '<div class="card">' +
          '<div class="field"><label class="lbl">CV page content (HTML + Markdown)</label>' +
            '<textarea id="cvbody" rows="18">' + esc(fm.body) + "</textarea>" +
            '<div class="field-hint">The body of <code>_pages/cv.md</code> — the PDF embed plus the Summary / Education / Skills sections.</div>' +
          "</div>" +
        "</div>" +
        '<div class="card"><b>' + ic("file") + "CV PDF</b>" +
          '<p style="color:var(--text-2);font-size:.87rem;margin:.5rem 0 0">Replaces <code>' + CV_PDF + "</code> — the file behind the Download button and the preview.</p>" +
          uploadWidget("cvpdf", "application/pdf") + "</div>";
      bindSave(view.querySelector("#save"), function () {
        return saveText("_pages/cv.md", joinFrontMatter(fm.data, view.querySelector("#cvbody").value), defaultCommitMsg("CV text"), f.sha);
      }, "CV");
      wireUpload(view, "cvpdf", CV_PDF, "CV PDF");
    });
  }

  /* =============================== Media ================================ */
  function viewMedia(view) {
    view.innerHTML = head("Media", "Replace your profile photo and CV PDF. Files keep the same name, so nothing else needs changing.") +
      '<div class="card"><b>' + ic("user") + "Profile photo</b>" +
        '<p style="color:var(--text-2);font-size:.87rem;margin:.5rem 0 0">Replaces <code>' + PHOTO + "</code>, shown on your home page. A square image works best.</p>" +
        uploadWidget("photo", "image/*") + "</div>" +
      '<div class="card"><b>' + ic("file") + "CV PDF</b>" +
        '<p style="color:var(--text-2);font-size:.87rem;margin:.5rem 0 0">Replaces <code>' + CV_PDF + "</code>.</p>" +
        uploadWidget("cvpdf2", "application/pdf") + "</div>";
    wireUpload(view, "photo", PHOTO, "Profile photo");
    wireUpload(view, "cvpdf2", CV_PDF, "CV PDF");
    return Promise.resolve();
  }

  function uploadWidget(id, accept) {
    return '<div class="upload-box" id="box-' + id + '">' +
      '<div id="prev-' + id + '"></div>' +
      '<input type="file" id="file-' + id + '" accept="' + accept + '">' +
      '<div><button class="btn btn-primary" id="up-' + id + '" disabled>' + ic("upload") + " Upload &amp; publish</button></div>" +
    "</div>";
  }
  function wireUpload(view, id, path, label) {
    var input = view.querySelector("#file-" + id),
        btn = view.querySelector("#up-" + id),
        prev = view.querySelector("#prev-" + id);
    var buffer = null;

    input.addEventListener("change", function () {
      var file = input.files[0];
      buffer = null; prev.innerHTML = ""; btn.disabled = true;
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        buffer = reader.result;
        btn.disabled = false;
        if (file.type.indexOf("image") === 0) {
          prev.innerHTML = '<img src="' + URL.createObjectURL(file) + '" alt="preview">';
        } else {
          prev.innerHTML = '<div style="color:var(--text-2);font-size:.85rem;margin-bottom:.6rem">' +
            esc(file.name) + " · " + Math.round(file.size / 1024) + " KB</div>";
        }
      };
      reader.readAsArrayBuffer(file);
    });

    btn.addEventListener("click", function () {
      if (!buffer) return;
      var orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = ic("spinner", "spin") + " Uploading…";
      saveBinary(path, bufToB64(buffer), defaultCommitMsg(label)).then(function () {
        toast("<b>" + label + " uploaded.</b> Live in ~1 min.", "success");
        input.value = ""; prev.innerHTML = "";
      }).catch(function (e) {
        toast("Upload failed: " + esc(e.message || e), "error");
      }).then(function () {
        btn.innerHTML = orig; btn.disabled = true;
      });
    });
  }

  /* =============================== Blog ================================= */
  function viewBlog(view) {
    return api(repoPath("/contents/_posts?ref=" + BRANCH))
      .catch(function (e) { if (e.status === 404) return []; throw e; })
      .then(function (list) {
        var posts = (Array.isArray(list) ? list : [])
          .filter(function (x) { return /\.(md|markdown)$/.test(x.name); })
          .sort(function (a, b) { return a.name < b.name ? 1 : -1; });

        view.innerHTML = head("Blog", "Your posts in <code>_posts/</code>.",
          '<button class="btn btn-primary" id="new">' + ic("plus") + " New post</button>") +
          (posts.length ? posts.map(function (p) {
            return '<div class="item"><div class="item-head" style="border:none;padding:0;margin:0">' +
              "<div><b>" + esc(prettyPost(p.name)) + '</b><div style="color:var(--muted);font-size:.78rem">' + esc(p.name) + "</div></div>" +
              '<div class="item-tools">' +
                '<button class="btn btn-sm" data-edit="' + esc(p.path) + '">' + ic("pen") + " Edit</button>" +
                '<button class="btn btn-sm btn-danger" data-delpost="' + esc(p.path) + '" data-sha="' + esc(p.sha) + '">' + ic("trash") + " Delete</button>" +
              "</div></div></div>";
          }).join("") : emptyState("No posts yet. Click <b>New post</b> to write one."));

        view.querySelector("#new").onclick = function () { editPost(view, null); };
        view.querySelectorAll("[data-edit]").forEach(function (b) {
          b.onclick = function () { editPost(view, b.dataset.edit); };
        });
        view.querySelectorAll("[data-delpost]").forEach(function (b) {
          b.onclick = function () {
            if (!confirm("Delete this post?\n\nThis immediately commits a deletion to your live site.")) return;
            deleteFile(b.dataset.delpost, b.dataset.sha, defaultCommitMsg("delete post")).then(function () {
              toast("<b>Post deleted.</b> Live in ~1 min.", "success");
              go("blog");
            }).catch(function (e) { toast("Delete failed: " + esc(e.message || e), "error"); });
          };
        });
      });
  }
  function prettyPost(name) {
    var m = /^\d{4}-\d{2}-\d{2}-(.+)\.(md|markdown)$/.exec(name);
    return m ? m[1].replace(/-/g, " ") : name;
  }

  function editPost(view, path) {
    var isNew = !path;
    var load = isNew
      ? Promise.resolve({ data: { layout: "post", title: "", date: todayStr(), categories: [], excerpt: "" }, body: "", sha: null })
      : getFile(path).then(function (f) {
          var fm = splitFrontMatter(f.text);
          return { data: fm.data, body: fm.body, sha: f.sha };
        });

    load.then(function (post) {
      var d = post.data || {};
      view.innerHTML = head(isNew ? "New post" : "Edit post", "",
        '<button class="btn" id="back">' + ic("back") + " Back</button>" + saveBtn(isNew ? "Publish" : "Save")) +
        '<div class="card">' +
          '<div class="grid-2">' +
            '<div class="field"><label class="lbl">Title</label><input type="text" id="p-title" value="' + esc(d.title) + '"></div>' +
            '<div class="field"><label class="lbl">Date</label><input type="date" id="p-date" value="' + esc(dateOnly(d.date)) + '"></div>' +
          "</div>" +
          '<div class="field"><label class="lbl">Categories</label><input type="text" id="p-cats" value="' + esc([].concat(d.categories || []).join(", ")) + '">' +
            '<div class="field-hint">Comma-separated.</div></div>' +
          '<div class="field"><label class="lbl">Excerpt</label><textarea id="p-exc" rows="2">' + esc(d.excerpt) + "</textarea></div>" +
          '<div class="field"><label class="lbl">Body (Markdown)</label><textarea id="p-body" rows="16">' + esc(post.body) + "</textarea></div>" +
        "</div>";

      view.querySelector("#back").onclick = function () {
        if (dirty && !confirm("Discard unsaved changes to this post?")) return;
        go("blog");
      };
      bindSave(view.querySelector("#save"), function () {
        var title = view.querySelector("#p-title").value.trim();
        var date = view.querySelector("#p-date").value || todayStr();
        if (!title) throw new Error("Title is required.");
        var data = Object.assign({}, d, {
          layout: d.layout || "post",
          title: title,
          date: date,
          categories: view.querySelector("#p-cats").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
          excerpt: view.querySelector("#p-exc").value
        });
        var text = joinFrontMatter(data, view.querySelector("#p-body").value);
        var target = path || ("_posts/" + date + "-" + slugify(title) + ".md");
        return saveText(target, text, defaultCommitMsg(isNew ? "new post" : "edit post"), post.sha)
          .then(function () { setTimeout(function () { go("blog"); }, 500); });
      }, "Post");
    });
  }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateOnly(s) {
    if (!s) return todayStr();
    var m = /^(\d{4}-\d{2}-\d{2})/.exec(String(s));
    return m ? m[1] : todayStr();
  }

  /* ============================= Settings =============================== */
  function viewSettings(view) {
    var storage = localStorage.getItem(LS.tokenEnc)
      ? "Encrypted with a passphrase"
      : (localStorage.getItem(LS.tokenPlain) ? "Saved in this browser" : "This session only");

    view.innerHTML = head("Settings", "Token, commit messages, and appearance.") +
      '<div class="card"><b>Commit messages</b>' +
        '<div class="field" style="margin-top:.8rem"><label class="lbl">Default template</label>' +
          '<input type="text" id="msg" value="' + esc(localStorage.getItem(LS.commitMsg) || "admin: update {what}") + '">' +
          '<div class="field-hint"><code>{what}</code> is replaced with what you edited (e.g. “profile”).</div></div>' +
        '<button class="btn btn-primary" id="saveMsg">' + ic("check") + " Save template</button></div>" +
      '<div class="card"><b>' + ic("lock") + "Token &amp; security</b>" +
        '<p style="color:var(--text-2);font-size:.87rem;margin:.6rem 0 .9rem">Storage: <b>' + storage +
          "</b>. This token is what lets the panel edit your site — keep it private and give it a short expiry.</p>" +
        '<div class="foot-actions" style="flex-wrap:wrap;gap:.5rem">' +
          '<button class="btn" id="lock2">' + ic("lock") + " Lock now</button>" +
          '<button class="btn btn-danger" id="signout">' + ic("signout") + " Sign out &amp; forget token</button>" +
          '<a class="btn" href="https://github.com/settings/tokens" target="_blank" rel="noopener">' + ic("github") + " Manage tokens</a>" +
        "</div></div>" +
      '<div class="card"><b>Appearance</b>' +
        '<div style="margin-top:.8rem"><button class="btn" id="theme2">' + ic("moon") + " Toggle light / dark</button></div></div>";

    view.querySelector("#saveMsg").onclick = function () {
      localStorage.setItem(LS.commitMsg, view.querySelector("#msg").value);
      setDirty(false);
      toast("Template saved.", "success");
    };
    view.querySelector("#lock2").onclick = lock;
    view.querySelector("#theme2").onclick = toggleTheme;
    view.querySelector("#signout").onclick = function () {
      if (!confirm("Forget the token from this browser and sign out?")) return;
      localStorage.removeItem(LS.tokenPlain);
      localStorage.removeItem(LS.tokenEnc);
      sessionStorage.removeItem(LS.tokenPlain);
      token = null; user = null; dirty = false;
      renderLogin(null);
    };
    return Promise.resolve();
  }

  /* ============================== Misc UI =============================== */
  function lock() {
    if (dirty && !confirm("You have unsaved changes. Lock anyway?")) return;
    token = null; user = null; dirty = false;
    renderLogin(localStorage.getItem(LS.tokenEnc) || null);
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    var next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(LS.theme, next); } catch (e) {}
  }

  window.addEventListener("beforeunload", function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ============================== Bootstrap ============================== */
  function boot() {
    if (typeof jsyaml === "undefined") {
      app.innerHTML = '<div class="boot">Could not load the YAML library (offline?). Please refresh.</div>';
      return;
    }
    var sessionTok = sessionStorage.getItem(LS.tokenPlain);
    var plain = localStorage.getItem(LS.tokenPlain);
    var enc = localStorage.getItem(LS.tokenEnc);

    if (sessionTok || plain) {
      validateToken(sessionTok || plain).then(enterApp).catch(function () {
        // stale / expired token — clear it and ask again
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

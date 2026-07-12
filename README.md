# Md-Noman-Biswas.github.io

Personal academic website built with **Jekyll 4** and hosted on **GitHub Pages**.
Live at **https://md-noman-biswas.github.io**.

Every push to `main` triggers the GitHub Actions workflow in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds the site and
publishes it automatically (usually live within ~1 minute).

---

## ✍️ Editing content — the Admin panel

You don't need to touch code to update the site. There's a built-in admin panel at:

> **https://md-noman-biswas.github.io/admin/**

It's a small in-browser app that edits the site's content files and commits them straight to
this repository via the GitHub API — which then auto-deploys. **No server, no database, nothing
that can expire or "sleep": it's 100% free and always available**, because it uses only GitHub
Pages + GitHub's own API.

You can edit from **any device** (laptop or phone) — just sign in with your token.

### What you can edit
| Section | File it edits |
| --- | --- |
| Profile, bio, social links | `_data/profile.yml` |
| Research interests | `_data/interests.yml` |
| Recent news | `_data/news.yml` |
| Publications | `_data/publications.yml` |
| Projects | `_data/projects.yml` |
| CV text + CV PDF | `_pages/cv.md`, `assets/pdf/…pdf` |
| Blog posts (create / edit / delete) | `_posts/*.md` |
| Profile photo | `assets/img/profile_photo.jpg` |

### First-time setup: create your access token
The admin page is public, but it can't change anything without a GitHub token that has write
access to this repo. Create one (takes a minute):

1. Go to **[GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token](https://github.com/settings/personal-access-tokens/new)**.
2. **Expiration:** pick something like 90 days (you can always make a new one).
3. **Repository access:** *Only select repositories* → choose **`Md-Noman-Biswas.github.io`**.
4. **Permissions → Repository permissions → Contents:** set to **Read and write**. Leave
   everything else as *No access*.
5. Click **Generate token** and copy it.
6. Open `/admin/`, paste the token, and sign in.

### Signing in / security
When you sign in you can choose how the token is remembered:
- **On this device** — saved in the browser (simplest, use on your own computer).
- **Encrypted with a passphrase** — the token is AES-encrypted in the browser; you enter a
  passphrase to unlock each visit (good for shared/less-trusted devices).
- **This session only** — forgotten when you close the tab.

Use the **Lock** button to clear the token from memory, or **Sign out & forget token** (in
Settings) to remove it from the browser entirely. If a token expires, the panel simply asks you
to paste a new one. The token grants write access to this repo, so keep it private and prefer a
short expiry — you can revoke it anytime from the GitHub tokens page.

---

## 🛠️ Local development

```bash
bundle install
bundle exec jekyll serve
# site at http://localhost:4000  ·  admin at http://localhost:4000/admin/
```

Content lives in `_data/` (structured YAML), `_pages/`, and `_posts/`. Layouts/partials are in
`_layouts/` and `_includes/`; styles in `_sass/` (compiled via `assets/css/main.scss`). The
admin app is the static files in `admin/` and is excluded from search engines via `noindex`.

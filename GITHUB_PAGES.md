# GitHub Pages Live Demo

This package is ready to host as a static GitHub Pages demo.

## Fastest setup

1. Create a GitHub repository.
2. Upload the **contents** of this project folder to the repository root.
3. Commit and push.
4. In GitHub open **Settings → Pages**.
5. Choose **Deploy from a branch**.
6. Select your main branch and `/ (root)`.
7. Save.

Your live demo will look like:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

## What works on GitHub Pages

The static demo supports:

- full control dashboard
- branding/logo upload/change/remove
- all timer modes and presets
- workout editing
- scenes
- camera test in supported HTTPS browsers
- focus/fullscreen modes
- overlay page
- same-browser tab/window synchronization
- configuration import/export

## Important remote-control note

GitHub Pages is static hosting, so it does **not** run `server.js`.

That means a second phone/tablet on another device cannot share realtime state through the local Node server while using only GitHub Pages.

For the client's real LAN phone/tablet workflow, use the included production runtime:

```bash
node server.js
```

Then open the LAN URL printed in the terminal.

The GitHub demo intentionally shows **GitHub demo** instead of looking like a broken connection.

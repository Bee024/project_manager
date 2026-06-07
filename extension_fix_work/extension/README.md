# NetAcad AutoRunner extension

Chrome MV3 extension for [www.netacad.com](https://www.netacad.com).

## Build

From the repo root:

```bash
npm run build:extension
```

This copies CCNA answer data into `extension/data/` and bundles `extension/runner.js`.

## Load unpacked

1. Run `npm run build:extension`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the `extension/` folder.
4. Open a NetAcad course on the top-level `www.netacad.com` tab.
5. Open the extension popup, pick **CCNA1 / CCNA2 / CCNA3**, click **Start**.

## Courses

| Option | Data file | NetAcad course |
|--------|-----------|----------------|
| CCNA1 | `variables_ccna1.js` | Introduction to Networks |
| CCNA2 | `variables_ccna2.js` | Switching, Routing, and Wireless Essentials |
| CCNA3 | `variables_ccna3.js` | Enterprise Networking, Security, and Automation |

To switch course after a run, **reload the NetAcad tab** (answer data cannot be replaced in-page).

## Popup

- **Start** — injects the selected course DB and runner into the page.
- **Stop** — stops the runner loop.
- **Activity** — short status lines (e.g. Scroll, Quiz, Submit, Video, Next, Stopped).

## Permissions

- `activeTab` + `scripting` — inject runner on the current NetAcad tab.
- `storage` — remember course choice and activity log.

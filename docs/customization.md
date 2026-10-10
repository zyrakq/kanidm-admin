# Customization

The customization subsystem lets a deployment replace the console's logo,
favicon and light/dark theme stylesheets without rebuilding the app. It is
compiled in behind the `customization` Cargo feature (enabled by default;
the `minimal` image variant ships without it).

## The Design page — the intended workflow

When the customization page is enabled (`[customization.page] enabled`,
`true` by default), a **Design** link appears in the footer of every page —
including the very first one you open. That link leads to `/design`, the
standalone customization page, and it is how customization is meant to be
used:

1. Open the app and click **Design** in the footer.
2. Upload a logo and favicon (light and dark variants), upload theme
   variant stylesheets and pick the active variant per mode — everything
   is editable right there, no config or restart needed.
3. When you are done, set `[customization.page] enabled = false` (or leave
   it on, if the page should stay available).

Disabling the page removes the footer link and the `/api/customization*`
management routes entirely (404 by absence) — but **asset serving is never
gated**: the uploaded logo, favicon and theme overrides keep working on
every page, because the site header, login page and theme-override
`<link>` elements request them all the time. So the typical cycle is:
enable → edit → disable, with the results staying in place.

## Image slots

Four overrideable image slots exist: `logo-light`, `logo-dark`,
`favicon-light` and `favicon-dark`. Accepted content types are
`image/svg+xml` (sanitized at write time) and `image/png`. Each slot is
stored as `<slot>` plus a `<slot>.meta` sidecar holding the persisted
content type, and every upload is limited to `customization.max_size_bytes`
(default 512 KiB — plenty for an SVG logo or a favicon PNG).

## Theme variants

Theme overrides are ordinary `.css` files in per-mode subfolders of the
customization dir: `themes/light/` and `themes/dark/` (default
`app/customization/themes/light|dark/`). Files uploaded into a mode's
folder appear automatically in that mode's dropdown on the Design page;
the folders are separate namespaces, so the same file name may exist in
both (its `:root` / `:root[theme='dark']` selectors decide what it
affects).

The active variant per mode resolves as:

1. a selection made on the Design page (persisted as `selection.json` in
   the customization dir),
2. the deployment default set via `[customization.theme]`
   (env: `APP_CUSTOMIZATION__THEME__LIGHT` /
   `APP_CUSTOMIZATION__THEME__DARK`, file name only — the folder is
   implied),
3. the built-in default (no override stylesheet; unset modes serve a
   `/* custom styles */` placeholder, following upstream Kanidm's
   `override.css` convention).

Legacy `theme-light` / `theme-dark` files in the customization root are
migrated into `themes/light/theme-light.css` /
`themes/dark/theme-dark.css` at startup.

## Management API

The `/api/customization*` routes exist only while the Design page is
enabled — the page is their only consumer:

| Endpoint                                         | Purpose                                |
| ------------------------------------------------ | -------------------------------------- |
| `GET /api/customization`                         | Manifest of slots, variants, selection |
| `PUT /api/customization/{slot}`                  | Upload a logo/favicon image            |
| `DELETE /api/customization/{slot}`               | Remove an uploaded image               |
| `POST /api/customization/themes/{mode}`          | Upload a theme variant CSS file        |
| `DELETE /api/customization/themes/{mode}/{name}` | Delete a theme variant                 |
| `PUT /api/customization/theme/{mode}`            | Select the active variant per mode     |
| `GET /customization/{slot}`                      | Serve an uploaded asset (always on)    |

## Configuration

| Setting                        | Default                                | Description                                      |
| ------------------------------ | -------------------------------------- | ------------------------------------------------ |
| `customization.dir`            | `""` (`<manifest_dir>/customization/`) | Directory for uploaded customization files       |
| `customization.max_size_bytes` | `524288`                               | Max upload size per slot                         |
| `customization.theme.light`    | `""`                                   | Deployment-default light theme variant file name |
| `customization.theme.dark`     | `""`                                   | Deployment-default dark theme variant file name  |
| `customization.page.enabled`   | `true`                                 | Design page: footer link + management API        |

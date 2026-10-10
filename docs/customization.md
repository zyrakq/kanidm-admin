# Customization

The customization subsystem lets a deployment replace the console's logo,
favicon and light/dark theme stylesheets without rebuilding the app. It is
compiled in behind the `customization` Cargo feature (enabled by default;
the `minimal` image variant ships without it).

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
folder appear automatically in that mode's dropdown on the customization
page; the folders are separate namespaces, so the same file name may exist
in both (its `:root` / `:root[theme='dark']` selectors decide what it
affects).

The active variant per mode resolves as:

1. a selection made on the customization page (persisted as
   `selection.json` in the customization dir),
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

## Customization page and API

The standalone customization page (linked from the footer) is the only
consumer of the management API and is enabled by default; disable it with
`[customization.page] enabled = false`. A disabled page removes the
`/api/customization*` routes entirely (404 by absence). Asset serving is
never gated — the site header logo, login page and theme-override
`<link>` elements depend on it on every page.

| Endpoint                                        | Purpose                              |
| ----------------------------------------------- | ------------------------------------ |
| `GET /api/customization`                        | Manifest of slots, variants, selection |
| `PUT /api/customization/{slot}`                 | Upload a logo/favicon image          |
| `DELETE /api/customization/{slot}`              | Remove an uploaded image             |
| `POST /api/customization/themes/{mode}`         | Upload a theme variant CSS file      |
| `DELETE /api/customization/themes/{mode}/{name}`| Delete a theme variant               |
| `PUT /api/customization/theme/{mode}`           | Select the active variant per mode   |
| `GET /customization/{slot}`                     | Serve an uploaded asset (always on)  |

## Configuration

| Setting                        | Default                                | Description                                      |
| ------------------------------ | -------------------------------------- | ------------------------------------------------ |
| `customization.dir`            | `""` (`<manifest_dir>/customization/`) | Directory for uploaded customization files       |
| `customization.max_size_bytes` | `524288`                               | Max upload size per slot                         |
| `customization.theme.light`    | `""`                                   | Deployment-default light theme variant file name |
| `customization.theme.dark`     | `""`                                   | Deployment-default dark theme variant file name  |
| `customization.page.enabled`   | `true`                                 | Standalone customization page + management API   |

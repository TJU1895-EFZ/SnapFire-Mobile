# Third-Party Notices

SnapFire Mobile's own source code is licensed under the **Apache License,
Version 2.0**. See `LICENSE` for the full text.

## Runtime dependencies

| Component | License | Notes |
| --- | --- | --- |
| `@vladmandic/human` | MIT | Copyright (c) Vladimir Mandic. Bundled model license: `public/models/LICENSE-human.txt`. |
| React | MIT | |
| React DOM | MIT | |
| Three.js | MIT | |

## Bundled AI models

`blazeface`, `faceres`, `movenet-lightning` and `centernet` are redistributed
unmodified as part of `@vladmandic/human`. Model credits and upstream licenses:

- https://github.com/vladmandic/human/wiki/Models

Keep `public/models/LICENSE-human.txt` when redistributing the built app.

## Development-only dependencies

Not shipped in the application bundle:

- Vite, `@vitejs/plugin-react`, Vitest, `fake-indexeddb`, `ws`, `playwright-core`: MIT
- TypeScript: Apache-2.0
- `@types/*`: MIT

## Original assets

The SnapFire icon (`public/icons/`), the homepage operator SVG, and the 3D
weapon/arm primitives are original to this project and covered by the project
license.

## User-supplied reference assets

`public/assets/uniforms/red-army.jpg` and `public/assets/uniforms/kmt.jpeg`
are provided by the project owner for the Long March uniform overlay.

## Full license texts

- Apache-2.0: `LICENSE`
- MIT (Human models): `public/models/LICENSE-human.txt`
- Other MIT texts are available in each package under `node_modules/`.

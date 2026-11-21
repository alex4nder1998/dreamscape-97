# Contributing to Dreamscape 97

Thanks for helping. There are three ways in, from easiest to most involved:

1. **Share a world.** Make something, tap **⬆ Submit** in the Scenes tab, and it may get featured in the in-app gallery.
2. **Report a bug or suggest an idea.** [Open an issue](https://github.com/alex4nder1998/dreamscape-97/issues/new/choose). For rendering bugs, a share link (🔗 Share) plus your browser and device helps a lot.
3. **Send code.** Fork the repo, make a branch, and open a pull request.

## Running it

It's one file. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

There's no build step, no npm and no framework. Please keep it that way: a PR that adds a bundler or dependency will likely be declined.

## Finding your way around `index.html`

| Part | What's there |
|---|---|
| `<style>` | All UI styling |
| `<script id="fs">` | The renderer: one WebGL 2 fragment shader that ray-marches signed distance fields. `objSDF` (shapes), `skyCol` and `planets` (sky), `getMat` and `groundMat` (materials), `shade*` (lighting, reflection, refraction), `main` (camera, glow halos, lens flare, 90s finish) |
| `MATS`, `GROUNDS`, `SKIES` | The lists behind the pickers. A material's index must match its number in `getMat`, and the same goes for grounds in `groundMat` |
| `SCENES` | The preset worlds |
| `encodeScene` / `decodeScene` | The share-link format. If you add a setting that should survive a link, add it to both and keep old links working |
| `loadCommunity` | The gallery, built from GitHub issues labelled `featured` |

### Adding a preset scene

Add an entry to `SCENES`. Each object is `[type, x, z, {size, stretch, lift, rot, tilt, m, seed}]`. Types are 1 sphere, 2 cube, 3 cylinder, 4 cone, 5 pyramid, 6 torus, 7 terrain, 8 floating island. `m` is the material index in `MATS`. `az` is the sun's angle from straight ahead in radians. Build the scene in the app first, then copy the numbers.

## Pull request checklist

- [ ] Tested in at least one desktop browser **and** on a phone, or in a phone-sized window
- [ ] No errors in the browser console
- [ ] For anything visual, a before and after screenshot in the PR
- [ ] Share links made before your change still open correctly
- [ ] Nothing that reads gallery or link data skips `decodeScene`'s checks: that data comes from strangers

## Ground rules

- Keep it original. No assets, names or logos from commercial software or album covers.
- Be kind in issues and reviews.

By contributing, you agree that your work is released under the [MIT License](LICENSE).

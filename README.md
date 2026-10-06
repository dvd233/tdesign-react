# Source-bound TDesign Table browser validation

## Current status

This validation package has frozen source inputs and local build-only checks. Its static/synthetic checks and real esbuild regression are verified separately; none is browser evidence. Actual browser results must be read from a specific hosted run and its evidence, not inferred from this document. The candidate's separate native build, lint, unit and snapshot suites also pass; none of those results is browser evidence. The original executor's Chromium launch was denied (`socket: Operation not permitted`), so this package never retries a local browser, another browser, port workaround or disabled sandbox. Screenshots and baseline/fixed browser results require the separate authorized GitHub Actions run.

The baseline is Tencent/tdesign-react develop commit `d31df33c40a774d435fd00580f72d99f4d271cf0`. The published source-only candidate is `cf53cf0d947d3d30cf616ebdcb81b305b6fea98b`, with tree `78e2b9627f75910592106ec7280c02ed4b2aa422`, on `dvd233/tdesign-react:fix/table-current-page-selection`. The approved fork identity is repository ID `1407033111`, owner ID `111864431`. `source-manifest.json` is now ready and binds that exact candidate commit, the two product-file hashes, `candidate.patch` and `locks/pnpm-lock.yaml`. Ready means the inputs are frozen, not that browser validation has passed. No floating branch or npm TDesign package is accepted as the fixed source.

## Separation from product PR

Keep this entire package on its own `validation/table-page-selection` branch in `dvd233/tdesign-react`, with these files at the branch root. Its sole workflow sits at `.github/workflows/validate-table-page-selection.yml`. Build its publication tree from an empty index containing exactly the 32 inventoried validation files; do not layer those files onto the product/candidate tree. A validation commit may use the verified source commit as its parent, but its tree must remain the independent validation-only tree. No other inherited product workflow belongs on this branch. Do not copy the workflow, harness, source lock, screenshots or runner into the product branch/PR. The product PR contains only the approved hook change and repository-native tests.

No publication is performed by the preparation scripts. The source-only product commit is already published; creating/pushing the separate validation branch remains a distinct authorized publication step. A later authorized push to the exact validation branch triggers CI. `workflow_dispatch` is also present, but GitHub may require the workflow to be registered on the default branch before a manual dispatch; use the branch-push trigger rather than adding validation files to the product/default branch just to enable it.

The workflow uses only public Git source and package registries. It grants `contents: read`, disables persisted checkout credentials, clones source without an authentication token, has no third-party service credentials, no publish/PR/comment/deploy step, and uploads evidence only as GitHub Actions artifacts. Both the workflow job condition and pre-install runtime guard require the exact approved repository name, repository ID, owner ID, `refs/heads/validation/table-page-selection`, and a `push` or `workflow_dispatch` event. The candidate repository must equal that approved fork. Other forks, renamed/lookalike validation branches and other dispatch targets fail closed. Chromium uses its sandbox on the hosted Ubuntu 22.04 runner; a sandbox/runtime failure is a hard validation failure, never grounds to weaken security settings.

## Frozen inputs

Read `source-manifest.json` for all exact versions/hashes. Current source declares `.node-version=22` and `packageManager=pnpm@10.33.0`; older Node 18/pnpm 9 prose is not used. This workflow pins Node `22.23.3`, pnpm `10.33.0`, esbuild `0.25.12`, Playwright Core `1.56.1`, Chromium revision `1194` / `141.0.7390.37`. Official Actions are pinned to full verified commit SHAs; `actions-lock.json` records the official repository, tag, peeled commit and read-only `git ls-remote` source checked on 2026-10-06.

The upstream baseline has no committed `pnpm-lock.yaml`. The single resolved source lock is now frozen in `locks/pnpm-lock.yaml` (559338 bytes; SHA-256 `88264a86728358ff99bb263be5db7cc50ebc6e28e6a96165b9a0c56b0713cc2f`). Install both source checkouts with these same bytes using `--frozen-lockfile --ignore-scripts`. Preserve that lock as evidence; it is not part of the product PR. The harness has its own exact `package-lock.json` and no dependency on npm `tdesign-react`, React or ReactDOM: it resolves React from the checked-out source's installed dependency tree.

The approved changed-file map contains only the hook and its new regression test. The preparation command used to bind the reviewed inputs is:

    node scripts/freeze-inputs.mjs --patch /absolute/frozen/candidate.patch --lock /absolute/frozen/pnpm-lock.yaml --changed-files /absolute/frozen/product-file-hashes.json --repository dvd233/tdesign-react --sha cf53cf0d947d3d30cf616ebdcb81b305b6fea98b

The script copies only into this validation package and records hashes. It performs no install, Git write or publication. Partial freezing is allowed for preparation; `status` stays draft until all inputs exist. CI refuses a draft. After freezing, review the manifest and ensure its candidate source SHA is the actual published product commit, never a validation commit, merge ref or local guess.

## Build/source chain

1. Check out the validation branch with persisted credentials disabled.
2. Fetch baseline and fixed source separately at full immutable SHAs; initialize their exact recursive submodule gitlinks.
3. Check Node/pnpm declarations, clean tracked source/submodules, baseline hook hash, fixed changed-path set and each approved file hash, candidate patch hash and the shared dependency lock. Apply the frozen patch to the baseline in a separate temporary Git index, write its tree and require exact equality to the real candidate commit tree; record baseline, candidate and reconstructed tree IDs. The real source worktree and index remain untouched.
4. Install source dependencies with `--frozen-lockfile --ignore-scripts`, then repeat the source gate before running any native build. Gitlink-pinned submodules are initialized explicitly beforehand; the source preinstall returns immediately in CI and its prepare only installs Git hooks, so neither is required to compile the product. Skipping lifecycle scripts avoids Husky 7 generating an ignored `.husky/_` directory and leaves the strict source-input gate unchanged. The separate harness `npm ci` still runs its own locked esbuild installation scripts. Scan untracked files and directories without `--exclude-standard`, so ignored source/config files are also rejected, including each recursive submodule. The only untracked allowances are dependency directories at committed package roots, the separately hash-checked root lock, and the five explicit `packages/tdesign-react/{es,esm,lib,cjs,dist}` output directories. A same-name `.js` override or extra/ignored `.tsx` is rejected. Run the repository's native `pnpm run build` independently for both checkouts. No npm TDesign substitute, checked-in prebuilt bundle or hand-reimplemented selection logic is used.
5. Bundle the identical harness against the build's `packages/tdesign-react/lib/table/index.js` and generated full component stylesheet `dist/tdesign.css`. Resolve React/ReactDOM from that checkout.
6. Resolve every real esbuild metafile input to its canonical filesystem path. Only the exact trusted object-define pseudo-input `<define:__VALIDATION_PROVENANCE__>` is exempt from realpath; unknown pseudo-inputs and missing real files fail. Verify the final browser bundle's chained sourcemap embeds `useRowSelect.tsx` with exactly the frozen source hash. Reject an npm TDesign input; record esbuild input graph, JS/CSS/map hashes and resolved React versions.
7. Compare source bindings before install, after install/before build, after build and after browser execution. Compare harness/spec/runner/lock/browser/submodule identities between baseline and fixed.

A build failure, missing source map, dirty source, missing submodule, dependency lock mismatch or unexpected candidate file fails CI. It is not a product-regression red.

## Same real browser specification, precise red and green

Both variants run `scripts/spec.mjs` through `scripts/browser-regression.mjs` without variant-specific selectors or interactions. The real Table receives six synthetic rows (`id=1..6`), two rows per page, controlled selected keys and normal `defaultCurrent/defaultPageSize` pagination. Browser actions click the actual header checkbox label and the actual Table pagination buttons.

Four scenarios: `reserveSelectedRowOnPaginate=false/true`, each starting independently on page 1 and page 2. Every scenario checks:

- Page readiness, runtime source identity, rendered row IDs, selected state, initial header and row checkbox states.
- Header select, unselect, repeat select.
- Navigate to the other page while selected. False must emit `CLEAR_ON_PAGINATE` and clear; true must preserve all six keys with no selection event.
- Select/unselect/reselect the other page, navigate back, select/unselect again.
- Exact callback count, callback origin/type, `keys`, complete `selectedRowData` objects and IDs, controlled selected state, visible row identity and checkbox states at every checkpoint.

The unmodified baseline runner must exit **1** with exactly **20** contract differences: ten false-mode select actions, each differing in `keys` and `selectedRowDataIds`. Every such actual payload must be exactly `[1,2,3,4,5,6]` and matching six row objects; the expected payload is precisely the two displayed page IDs. False-mode clears/navigation and every true-mode checkpoint must pass. Baseline exit 0 is rejected because reproduction was not established.

Fixed must exit **0**, with the same spec passing every checkpoint. A browser/load/selector/runtime/network/cleanup error gives exit **2**, an incomplete report or an error entry, all rejected. Missing scenarios/checkpoints, arbitrary baseline assertion failures, other six-key values, unrelated behavior changes or changed specs are rejected. `tests/classifier.test.mjs` explicitly tests these rejection paths with clearly synthetic data; those unit tests are not browser evidence.

The original 13 classifier cases and the independent audit's 854 corrupted-report counterexamples are retained. Added synthetic tests cover execution-scope mismatches, non-patches and wrong patch trees, extra/ignored/same-name source inputs and submodule inputs, plus missing ready-image/trace evidence. These use isolated synthetic Git fixtures only; they do not constitute native product builds or browser evidence.

The classifier checks structured values rather than treating any nonzero baseline process as expected red. The workflow also compares the real runner exit code to the report's code. It deliberately does not use blanket `continue-on-error`.

## Evidence and reading the result

GitHub Actions uploads an artifact named `table-page-selection-RUN_ID-RUN_ATTEMPT`, even on failure. It includes:

- `evidence/VERDICT.json` only when exact baseline red + fixed green and source checks all succeed.
- `baseline/results.json`, `fixed/results.json`: complete preconditions and every callback, expected value and mismatch.
- Labelled before/after PNG screenshots for ready state and every action, showing the source commit and actual callback payload. Ready-state and checkpoint images have verified hashes.
- Per-scenario Playwright trace ZIPs with screenshots, DOM snapshots and source, each required and hash-checked by the final verifier; interrupted trace when possible.
- Native install/build logs, dependency locks, before/after source records, harness provenance, bundle/map and esbuild input graph.

Screenshots alone are not a pass. A successful job plus `VERDICT.json`, exact immutable source IDs, both structured reports and expected PNGs constitute the evidence. If the hosted runner cannot build or launch Chromium, report that blocker and retain logs; do not call it baseline reproduction or fixed verification.

## Allowed local checks

    node scripts/check-syntax.mjs
    node --test tests/*.test.mjs

The runner has a CI-only guard before any server/browser startup. Do not set `GITHUB_ACTIONS=true` to bypass it locally. Do not run a local Playwright install/launch to work around the prior denial. `npm run build:harness` is build-only but requires the real source library to have been built first; a syntax transform is not a source-bound build.

## Scope

This browser artifact targets the ordinary Table current-page select-all defect, default pagination and the required true-mode control. It is not a claim that all repository unit/snapshot/lint checks pass, and it does not claim browser coverage of tree/disabled/remote pagination. Those unchanged boundaries belong in the separate repository-native regression suite. No historical issue is automatically closed or claimed by this package.

Reference source policies read: root AGENTS.md, `.codebuddy/skills/tdesign-test-component/SKILL.md`, actual root/package manifests, `.node-version`, `.gitmodules`, native Rollup config, and `.github/workflows/pull-request.yml` / `preview-build.yml` at the baseline SHA.

The full native stylesheet is intentional: the native `es/style/index.css` contains only global styles and no Table rules. The selected `dist/tdesign.css` includes Table, Checkbox and Pagination styling for real interaction screenshots. This was verified from the completed native build without launching a browser.

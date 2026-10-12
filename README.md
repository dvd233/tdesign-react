# Select virtual option spacing

Source comparison for Tencent/tdesign-react#3189, based on develop
`d31df33c40a774d435fd00580f72d99f4d271cf0` (TDesign 1.18.4).

Both builds use the real Select, Popup, Option and icon components, the same
compiled common styles, React 18.3.1, and Windows Chromium 155 at DPR 1.75.
The fixture uses 1000 deterministic options (seed 3189), multiple selection,
filterable/reserveKeyword/clearable, a 600px Select and a 300px popup.

Trusted wheel input advanced scrollTop by 72px in each of three comparisons.
At 250ms after scrolling, globally unique overlapping labels had the following
extra displacement (`delta label top + delta scrollTop`):

| Source | Comparison 1 | Comparison 2 | Comparison 3 |
| --- | ---: | ---: | ---: |
| Unmodified baseline | -4px | -6px | -4px |
| Fixed source | 0px | 0px | 0px |

Duplicate labels were excluded globally, and the popup position stayed fixed.
The baseline had 7/8/7 label pairs; the fixed build had 8/8/7.
Both CSS outputs have SHA-256
`29b8a445ab8cb2cf5a7bd7534b0c6eb7f4991e3abac97f37b70941cfe5727e58`.

`before.jpg` and `after.jpg` are actual browser screenshots of the source
fixtures. They show the rendered panels; the displacement claim comes from
the coordinate measurements and regression tests, not from still images.
This comparison isolates omitted option spacing. It does not establish that
all jitter or blank-content symptoms in the original 1.9.2 report have the
same cause.

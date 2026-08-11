# Icons

One folder, one set. Every icon is **monochrome** and gets its color at render
time from the CSS-mask [`<Icon>`](../../../src/components/Icon.tsx) component
(`background-color: currentColor` + `mask: url(...)`), so the same file can be
teal on a card, dark on the nav's white chips, bright on a map arrow, or white
on an active pill. **Never bake more than one color into an icon.**

```tsx
import Icon from '@/components/Icon'
;<Icon src="/images/icons/globe.svg" className="color-teal-300" /> // size defaults to 16
```

## Designing a new icon

- **Sizes**: 12×12 (small), 16×16 (**default — ~90% of use**), 24×24 (large),
  32×32 (xl — for hero moments). Icons render at **exactly** one of these four —
  never an in-between value (no `size={20}` or `size={28}`). Large is 24;
  **xl (32) is the default grid doubled**.
- **Style**: **1px stroke**, **rounded** corners/joins, teal-300 `#AAB2B3`.
  Knockouts (the negative-space gaps where strokes meet) are also **1px**.
- **Equal visual _area_**: size every icon so it carries roughly the same amount
  of _ink_ — they should read at the same weight, not fill the same box.
- **Stroke aligned inside** the guide shape (the guide is the outer edge).
- **Straight lines pixel-fit** — land on whole pixels so they render crisp.
- Design on top of `grid-template-{small,default,large,xl}.svg` (base shapes +
  the two 45° diagonals + an inner circle).

### Base shapes (outer dimensions)

Start from the base shape matching the object's natural silhouette, then adjust.

| Shape                             | small (12) | default (16) | large (24) | xl (32) |
| --------------------------------- | ---------- | ------------ | ---------- | ------- |
| Circle (main)                     | 10         | 13           | 20         | 26      |
| Inner circle                      | 4          | 6            | 8          | 12      |
| Vertical / high rectangle (w×h)   | 8×10       | 10×14        | 16×20      | 20×28   |
| Horizontal / long rectangle (w×h) | 10×8       | 14×10        | 20×16      | 28×20   |
| Square                            | 9          | 12           | 18         | 24      |

Small is exactly half of large; default sits between; **xl is the default
doubled** (16→32, every dimension ×2). Stroke stays **1px** at every size.

## Naming

Literal by **shape**, lowercase-kebab (`globe.svg`, `magnifying-glass.svg`) —
**not** by use. The same shape gets reused across different contexts.

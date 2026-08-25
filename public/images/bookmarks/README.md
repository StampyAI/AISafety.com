# Bookmarks

Bookmarks are the little ribbon/tab accents on cards. They are **NOT icons** —
they are a separate decorative system, and unlike icons they **may be
multi-color or contain gradients**.

Because of that they are rendered with their **full baked color** (via
`next/image` `<Image>` or a CSS `mask` for a solid per-card tint), **not** through
the monochrome `<Icon>` component. A gradient bookmark is just an SVG with a
`<linearGradient>`/`<radialGradient>` dropped in here and rendered via `<Image>`.

- `bookmark-light.svg` / `bookmark-dark.svg` — full-size ribbon (24×36)
- `bookmark-small.svg` / `bookmark-dark-small.svg` — small ribbon (16×24)

Solid per-card tints use the `.bookmarkAccent` CSS mask (see
`src/components/FeaturedCard.module.css`), which recolors a shape to a single
`currentColor`. For anything with more than one color (a gradient), skip the
mask and render the SVG directly with `<Image>`.

Do **not** move these into `public/images/icons/` — that folder is the
monochrome icon library enforced by the `<Icon>` guardrails.

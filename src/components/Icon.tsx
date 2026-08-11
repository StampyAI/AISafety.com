import styles from './Icon.module.css'

/** The only sizes icons may render at: small / default / large / xl.
 *  A union type, so an off-spec size (e.g. `size={20}`) is a COMPILE error.
 *  See public/images/icons/README.md. */
export type IconSize = 12 | 16 | 24 | 32

interface IconProps {
  /** Path to a monochrome svg shape in the library, e.g.
   *  "/images/icons/globe.svg". Must live under /images/icons/. */
  src: string
  /** Square size in px — one of 12 / 16 / 24 / 32. Default 16. */
  size?: IconSize
  /** Extra classes — typically a `.color-*` utility. Omit to inherit the
   *  surrounding text color (currentColor). */
  className?: string
}

// Renders a monochrome icon by CSS-masking the svg shape and filling it with the
// current color. One shape file works in ANY color via CSS: teal-300 on cards,
// dark on the nav's white chips, bright-teal on map chevrons, white anywhere —
// no per-color icon copies. (The svg's own baked color is irrelevant; the mask
// uses only its shape.) See Icon.module.css.
export default function Icon({ src, size = 16, className = '' }: IconProps) {
  // Fail loudly in dev if the invariants are broken (JS callers bypass the
  // types; dynamic `src` can't be checked at compile time). Never in prod.
  if (process.env.NODE_ENV !== 'production') {
    if (![12, 16, 24, 32].includes(size)) {
      throw new Error(
        `<Icon> size must be 12, 16, 24, or 32 (got ${size}). See public/images/icons/README.md.`
      )
    }
    if (!src.startsWith('/images/icons/')) {
      throw new Error(
        `<Icon src> must point into /images/icons/ (got "${src}"). Add the shape to the icon library instead of loading a one-off svg.`
      )
    }
  }
  return (
    <span
      aria-hidden="true"
      className={`${styles.icon} ${className}`}
      style={{
        width: size,
        height: size,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
      }}
    />
  )
}

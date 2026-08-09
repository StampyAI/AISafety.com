import styles from './Icon.module.css'

interface IconProps {
  /** Path to a monochrome svg shape, e.g. "/images/icons/globe.svg". */
  src: string
  /** Square size in px. Default 16. */
  size?: number
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

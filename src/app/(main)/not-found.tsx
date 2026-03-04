import Image from 'next/image'
import styles from './not-found.module.css'

export default function NotFound() {
  return (
    <div
      className={`flex flex-col gap-40px items-center justify-center ${styles['page-wrap']}`}
    >
      <Image
        src="/images/HAL9000.svg.png"
        alt="HAL 9000 computer interface"
        width={201}
        height={201}
        sizes="201px"
      />
      <div className="flex flex-col gap-16px items-center">
        <h2>404</h2>
        <p className="color-white">
          I&apos;m sorry, Dave, I can&apos;t find this page.
        </p>
      </div>
    </div>
  )
}

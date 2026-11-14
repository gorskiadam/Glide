import type { ReactNode } from 'react'
import { useT } from '../i18n'
import { Icon, type IconName } from './Icon'

export type Route = 'practice' | 'lessons' | 'progress' | 'settings'

const links: { route: Route; href: string; icon: IconName; label: 'nav.practice' | 'nav.lessons' | 'nav.progress' | 'nav.settings' }[] = [
  { route: 'practice', href: '#/', icon: 'keyboard', label: 'nav.practice' },
  { route: 'lessons', href: '#/lessons', icon: 'steps', label: 'nav.lessons' },
  { route: 'progress', href: '#/progress', icon: 'chart', label: 'nav.progress' },
  { route: 'settings', href: '#/settings', icon: 'settings', label: 'nav.settings' },
]

/** App frame: bottom nav on small screens, left sidebar from 980px, like Tempo. */
export function Shell({ route, typing, onPalette, children }: { route: Route; typing: boolean; onPalette: () => void; children: ReactNode }) {
  const t = useT()
  return (
    <div className="shell min-h-dvh" data-typing={typing}>
      <a className="skip-link" href="#main" onClick={(e) => {
        // The app uses the hash for routing, so move the focus by hand.
        e.preventDefault()
        document.getElementById('main')?.focus()
      }}>
        {t('a11y.skip')}
      </a>
      <nav className="nav" aria-label="Glide">
        <div className="brand">
          <div className="font-display flex items-center gap-2 text-[20px] font-extrabold tracking-tight">
            <span className="tile solid !h-7 !w-7 !rounded-[9px]">
              <Icon name="wave" />
            </span>
            Glide
          </div>
          <div className="text-accent-text mt-1 text-[11px] font-bold tracking-[0.14em] uppercase">{t('brand.tag')}</div>
        </div>
        <div className="nav-inner">
          {links.map((l) => (
            <a key={l.route} href={l.href} aria-current={route === l.route ? 'page' : undefined}>
              <Icon name={l.icon} />
              <span>{t(l.label)}</span>
            </a>
          ))}
        </div>
        <button type="button" className="palette-button" onClick={onPalette} aria-keyshortcuts="Control+K Meta+K">
          <Icon name="zap" />
          {t('palette.open')}
          <kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
      </nav>
      <main id="main" tabIndex={-1} className="outline-none desk:pb-16 desk:pt-7 mx-auto w-full max-w-[860px] px-4 pt-5 pb-28 sm:px-6">{children}</main>
    </div>
  )
}

import { CSSProperties, ReactElement, ReactNode, useEffect } from 'react';

// Visually hidden until focused — standard skip-nav pattern
const LINK_BASE_STYLES: CSSProperties = {
  position: 'absolute',
  top: '-100%',
  left: 0,
  zIndex: 9999,
  padding: '8px 16px',
  background: '#000000',
  color: '#ffffff',
  fontFamily: 'inherit',
  fontSize: '1rem',
  textDecoration: 'none',
  borderRadius: '0 0 4px 0',
};

// Injected once: makes the link visible on :focus via a stylesheet
const FOCUS_CSS = `.blazefw-skip-nav:focus { top: 0 !important; outline: 2px solid #005fcc; outline-offset: 2px; }`;

function injectFocusStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('blazefw-skip-nav-styles')) return;
  const style = document.createElement('style');
  style.id = 'blazefw-skip-nav-styles';
  style.textContent = FOCUS_CSS;
  document.head.appendChild(style);
}

export interface SkipNavLinkProps {
  /** href of the target content area. Defaults to "#skip-nav-content". */
  href?: string;
  children?: ReactNode;
}

/**
 * Render at the very top of the page. Visually hidden until focused via Tab,
 * at which point it floats over the page so keyboard users can skip repeated nav.
 *
 * @example
 * <SkipNavLink />
 * <nav>…</nav>
 * <SkipNavContent><main>…</main></SkipNavContent>
 */
export function SkipNavLink({
  href = '#skip-nav-content',
  children = 'Skip to content',
}: SkipNavLinkProps): ReactElement {
  useEffect(injectFocusStyles, []);

  return (
    <a href={href} style={LINK_BASE_STYLES} className="blazefw-skip-nav">
      {children}
    </a>
  );
}

export interface SkipNavContentProps {
  /** Element id that SkipNavLink targets. Defaults to "skip-nav-content". */
  id?: string;
  /** HTML element to render. Defaults to "main". */
  as?: 'main' | 'div' | 'section';
  children?: ReactNode;
}

/**
 * Place this around your main page content. Receives programmatic focus
 * when the skip link is activated.
 */
export function SkipNavContent({
  id = 'skip-nav-content',
  as: Tag = 'main',
  children,
}: SkipNavContentProps): ReactElement {
  return (
    // tabIndex={-1} allows programmatic focus without appearing in the natural tab order
    <Tag id={id} tabIndex={-1} style={{ outline: 'none' }}>
      {children}
    </Tag>
  );
}

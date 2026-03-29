import { CSSProperties, ElementType, ReactElement, ReactNode } from 'react';

/**
 * CSS pattern that hides an element visually while keeping it accessible
 * to screen readers. Preferred over `display:none` or `visibility:hidden`,
 * both of which hide content from assistive technology.
 */
const VISUALLY_HIDDEN_STYLES: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
};

export interface VisuallyHiddenProps {
  children: ReactNode;
  /**
   * HTML element to render. Defaults to `span` so it can be used inline.
   * Pass `"div"` for block-level content.
   */
  as?: ElementType;
}

/**
 * Render content that is invisible on screen but announced by screen readers.
 * Use for supplemental labels, icon button descriptions, or status messages
 * that should not appear in the visual layout.
 *
 * @example
 * <button>
 *   <Icon name="close" aria-hidden />
 *   <VisuallyHidden>Close dialog</VisuallyHidden>
 * </button>
 */
export function VisuallyHidden({
  children,
  as: Tag = 'span',
}: VisuallyHiddenProps): ReactElement {
  return <Tag style={VISUALLY_HIDDEN_STYLES}>{children}</Tag>;
}

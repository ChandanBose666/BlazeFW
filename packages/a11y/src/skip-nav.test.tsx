import { describe, it, expect, beforeEach } from '@jest/globals';
import { render } from '@testing-library/react';
import { SkipNavLink, SkipNavContent } from './skip-nav.js';

beforeEach(() => {
  // Remove injected style between tests so injection logic can be re-tested
  document.getElementById('blazefw-skip-nav-styles')?.remove();
});

describe('SkipNavLink', () => {
  it('renders an anchor element', () => {
    const { container } = render(<SkipNavLink />);
    expect(container.querySelector('a')).not.toBeNull();
  });

  it('has default href "#skip-nav-content"', () => {
    const { container } = render(<SkipNavLink />);
    expect(container.querySelector('a')).toHaveAttribute('href', '#skip-nav-content');
  });

  it('has default link text "Skip to content"', () => {
    const { getByText } = render(<SkipNavLink />);
    expect(getByText('Skip to content')).not.toBeNull();
  });

  it('accepts a custom href', () => {
    const { container } = render(<SkipNavLink href="#main-content" />);
    expect(container.querySelector('a')).toHaveAttribute('href', '#main-content');
  });

  it('accepts custom children', () => {
    const { getByText } = render(<SkipNavLink>Jump to main</SkipNavLink>);
    expect(getByText('Jump to main')).not.toBeNull();
  });

  it('is positioned off-screen by default (top: -100%)', () => {
    const { container } = render(<SkipNavLink />);
    const link = container.querySelector('a') as HTMLElement;
    expect(link.style.top).toBe('-100%');
  });

  it('has the skip-nav CSS class', () => {
    const { container } = render(<SkipNavLink />);
    expect(container.querySelector('a')).toHaveClass('blazefw-skip-nav');
  });

  it('injects the focus stylesheet into document.head', () => {
    render(<SkipNavLink />);
    expect(document.getElementById('blazefw-skip-nav-styles')).not.toBeNull();
  });

  it('does not inject duplicate stylesheets on re-render', () => {
    render(<SkipNavLink />);
    render(<SkipNavLink />);
    const sheets = document.querySelectorAll('#blazefw-skip-nav-styles');
    expect(sheets.length).toBe(1);
  });
});

describe('SkipNavContent', () => {
  it('renders as <main> by default', () => {
    const { container } = render(<SkipNavContent />);
    expect(container.querySelector('main')).not.toBeNull();
  });

  it('has default id "skip-nav-content"', () => {
    const { container } = render(<SkipNavContent />);
    expect(container.querySelector('main')).toHaveAttribute('id', 'skip-nav-content');
  });

  it('accepts a custom id', () => {
    const { container } = render(<SkipNavContent id="main-content" />);
    expect(container.querySelector('main')).toHaveAttribute('id', 'main-content');
  });

  it('has tabIndex={-1} for programmatic focus', () => {
    const { container } = render(<SkipNavContent />);
    expect(container.querySelector('main')).toHaveAttribute('tabindex', '-1');
  });

  it('renders as <div> when as="div"', () => {
    const { container } = render(<SkipNavContent as="div" />);
    expect(container.querySelector('div')).not.toBeNull();
    expect(container.querySelector('main')).toBeNull();
  });

  it('renders as <section> when as="section"', () => {
    const { container } = render(<SkipNavContent as="section" />);
    expect(container.querySelector('section')).not.toBeNull();
  });

  it('renders children', () => {
    const { getByText } = render(<SkipNavContent>Page content</SkipNavContent>);
    expect(getByText('Page content')).not.toBeNull();
  });
});

import { describe, it, expect } from '@jest/globals';
import { render } from '@testing-library/react';
import { VisuallyHidden } from './visually-hidden.js';

describe('VisuallyHidden', () => {
  it('renders its children', () => {
    const { getByText } = render(<VisuallyHidden>Close dialog</VisuallyHidden>);
    expect(getByText('Close dialog')).not.toBeNull();
  });

  it('renders as <span> by default', () => {
    const { container } = render(<VisuallyHidden>Label</VisuallyHidden>);
    expect(container.querySelector('span')).not.toBeNull();
  });

  it('renders as <div> when as="div"', () => {
    const { container } = render(<VisuallyHidden as="div">Label</VisuallyHidden>);
    expect(container.querySelector('div')).not.toBeNull();
    expect(container.querySelector('span')).toBeNull();
  });

  it('renders as <p> when as="p"', () => {
    const { container } = render(<VisuallyHidden as="p">Label</VisuallyHidden>);
    expect(container.querySelector('p')).not.toBeNull();
  });

  it('has position: absolute', () => {
    const { container } = render(<VisuallyHidden>x</VisuallyHidden>);
    expect((container.firstChild as HTMLElement).style.position).toBe('absolute');
  });

  it('has width and height of 1px', () => {
    const { container } = render(<VisuallyHidden>x</VisuallyHidden>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('1px');
    expect(el.style.height).toBe('1px');
  });

  it('has overflow: hidden', () => {
    const { container } = render(<VisuallyHidden>x</VisuallyHidden>);
    expect((container.firstChild as HTMLElement).style.overflow).toBe('hidden');
  });

  it('has clip style set', () => {
    const { container } = render(<VisuallyHidden>x</VisuallyHidden>);
    // jsdom normalises numeric 0 to 0px in clip values
    expect((container.firstChild as HTMLElement).style.clip).toMatch(/rect\(0/);
  });

  it('renders nested elements as children', () => {
    const { container } = render(
      <VisuallyHidden>
        <span>Nested</span>
      </VisuallyHidden>
    );
    expect(container.querySelector('span span')).not.toBeNull();
  });
});

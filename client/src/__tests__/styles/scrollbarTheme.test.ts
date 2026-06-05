import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../styles/globals.css';

const LIGHT_MUTED = '240 4.8% 95.9%';
const LIGHT_MUTED_FOREGROUND = '240 3.8% 46.1%';
const LIGHT_PRIMARY = '263 70% 50%';

const DARK_MUTED = '240 3.7% 15.9%';
const DARK_MUTED_FOREGROUND = '240 5% 64.9%';
const DARK_PRIMARY = '263 70% 58%';

const globalsCssPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../styles/globals.css');

function getGlobalsSource(): string {
  return readFileSync(globalsCssPath, 'utf-8');
}

function getInjectedStylesheetText(): string {
  let text = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        text += rule.cssText;
      }
    } catch {
      continue;
    }
  }
  return text;
}

function getScrollbarCss(): string {
  const injected = getInjectedStylesheetText();
  return injected.length > 0 ? injected : getGlobalsSource();
}

describe('scrollbar theme tokens', () => {
  it('should_expose_scrollbar_tokens_on_root_in_light_mode', () => {
    const css = getGlobalsSource();
    expect(css).toContain('--scrollbar-track: ' + LIGHT_MUTED);
    expect(css).toContain('--scrollbar-thumb: ' + LIGHT_MUTED_FOREGROUND);
    expect(css).toContain('--scrollbar-thumb-hover: ' + LIGHT_PRIMARY);
  });

  it('should_expose_dark_scrollbar_tokens_when_dark_class', () => {
    const css = getGlobalsSource();
    expect(css).toContain('.dark');
    expect(css).toContain('--scrollbar-track: ' + DARK_MUTED);
    expect(css).toContain('--scrollbar-thumb: ' + DARK_MUTED_FOREGROUND);
    expect(css).toContain('--scrollbar-thumb-hover: ' + DARK_PRIMARY);
  });

  it('should_define_scrollbar_size_token', () => {
    const css = getGlobalsSource();
    expect(css).toMatch(/--scrollbar-size:\s*8px/);
    expect(css).toMatch(/--scrollbar-button-size:\s*12px/);
  });
});

describe('global scrollbar rules', () => {
  let initialClassName: string;
  let fixture: HTMLDivElement | null = null;

  beforeEach(() => {
    initialClassName = document.documentElement.className;
    document.documentElement.className = '';
    fixture = document.createElement('div');
    fixture.style.overflow = 'auto';
    fixture.style.height = '100px';
    document.body.appendChild(fixture);
  });

  afterEach(() => {
    fixture?.remove();
    fixture = null;
    document.documentElement.className = initialClassName;
  });

  it('should_apply_thin_scrollbar_width_globally', () => {
    const style = getComputedStyle(fixture!);
    const width = style.scrollbarWidth || style.getPropertyValue('scrollbar-width');
    const css = getScrollbarCss();
    if (width === 'thin') {
      expect(width).toBe('thin');
    } else {
      expect(css).toMatch(/scrollbar-width:\s*thin/);
    }
  });

  it('should_set_scrollbar_color_from_theme_tokens', () => {
    const color = getComputedStyle(fixture!).scrollbarColor;
    const css = getScrollbarCss();
    if (color && /hsl/i.test(color)) {
      expect(color).toMatch(/hsl/i);
    } else {
      expect(css).toMatch(/scrollbar-color:\s*hsl\(var\(--scrollbar-thumb\)\)/);
    }
  });

  it('should_scope_firefox_scrollbar_props_outside_webkit', () => {
    const css = getGlobalsSource();
    expect(css).toMatch(/@supports not selector\(\::-webkit-scrollbar\)/);
    expect(css).toMatch(/scrollbar-width:\s*thin/);
  });

  it('should_include_webkit_scrollbar_hover_using_primary_token', () => {
    const css = getScrollbarCss();
    expect(css).toContain('::-webkit-scrollbar');
    expect(css).toMatch(/width:\s*var\(--scrollbar-size\)/);
    expect(css).toMatch(
      /::-webkit-scrollbar-thumb:hover\s*\{[^}]*background-color:\s*hsl\(var\(--scrollbar-thumb-hover\)\)/,
    );
    expect(css).not.toMatch(/::-webkit-scrollbar-thumb:hover[\s\S]*background-clip:\s*border-box/);
  });

  it('should_define_scrollbar_arrow_buttons', () => {
    const css = getGlobalsSource();
    expect(css).toMatch(/::-webkit-scrollbar-button:single-button\s*\{[^}]*display:\s*block/);
    expect(css).toContain('::-webkit-scrollbar-button:single-button:vertical:decrement');
    expect(css).toContain('::-webkit-scrollbar-button:single-button:vertical:increment');
  });
});

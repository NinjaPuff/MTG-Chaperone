import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusAndSelectInput } from '../../lib/focusSearchInputAfterStage';

describe('focusAndSelectInput', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('focuses and selects the input on the next animation frame', () => {
    const raf = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('requestAnimationFrame', raf);

    const input = document.createElement('input');
    input.value = 'bolt';
    const focusSpy = vi.spyOn(input, 'focus');
    const selectSpy = vi.spyOn(input, 'select');

    focusAndSelectInput(input);

    expect(raf).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });

  it('does nothing when input is null', () => {
    const raf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);

    focusAndSelectInput(null);

    expect(raf).not.toHaveBeenCalled();
  });
});

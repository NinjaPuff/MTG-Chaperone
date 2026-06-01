import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSearchResultsKeyboard } from '../../hooks/useSearchResultsKeyboard';

function makeKeyboardEvent(key: string) {
  return {
    key,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLInputElement>;
}

describe('useSearchResultsKeyboard', () => {
  it('ArrowDown from input with no results is a no-op', () => {
    const onSelectIndex = vi.fn();
    const { result } = renderHook(() =>
      useSearchResultsKeyboard({ resultCount: 0, onSelectIndex }),
    );

    act(() => {
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowDown'));
    });

    expect(result.current.activeIndex).toBeNull();
    expect(onSelectIndex).not.toHaveBeenCalled();
  });

  it('ArrowDown from input with results highlights the first item', () => {
    const { result } = renderHook(() =>
      useSearchResultsKeyboard({ resultCount: 3, onSelectIndex: vi.fn() }),
    );

    act(() => {
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowDown'));
    });

    expect(result.current.activeIndex).toBe(0);
  });

  it('ArrowDown clamps at the last result', () => {
    const { result } = renderHook(() =>
      useSearchResultsKeyboard({ resultCount: 3, onSelectIndex: vi.fn() }),
    );

    act(() => {
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowDown'));
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowDown'));
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowDown'));
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowDown'));
    });

    expect(result.current.activeIndex).toBe(2);
  });

  it('ArrowUp clamps at the first result', () => {
    const { result } = renderHook(() =>
      useSearchResultsKeyboard({ resultCount: 3, onSelectIndex: vi.fn() }),
    );

    act(() => {
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowDown'));
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowUp'));
    });

    expect(result.current.activeIndex).toBe(0);
  });

  it('ArrowUp from input mode is a no-op', () => {
    const { result } = renderHook(() =>
      useSearchResultsKeyboard({ resultCount: 3, onSelectIndex: vi.fn() }),
    );

    act(() => {
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowUp'));
    });

    expect(result.current.activeIndex).toBeNull();
  });

  it('Enter selects the highlighted result and resets highlight', () => {
    const onSelectIndex = vi.fn();
    const { result } = renderHook(() =>
      useSearchResultsKeyboard({ resultCount: 3, onSelectIndex }),
    );

    act(() => {
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowDown'));
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowDown'));
      result.current.handleInputKeyDown(makeKeyboardEvent('Enter'));
    });

    expect(onSelectIndex).toHaveBeenCalledTimes(1);
    expect(onSelectIndex).toHaveBeenCalledWith(1);
    expect(result.current.activeIndex).toBeNull();
  });

  it('Enter in input mode does not select', () => {
    const onSelectIndex = vi.fn();
    const { result } = renderHook(() =>
      useSearchResultsKeyboard({ resultCount: 3, onSelectIndex }),
    );

    act(() => {
      result.current.handleInputKeyDown(makeKeyboardEvent('Enter'));
    });

    expect(onSelectIndex).not.toHaveBeenCalled();
  });

  it('Escape clears the highlight', () => {
    const { result } = renderHook(() =>
      useSearchResultsKeyboard({ resultCount: 3, onSelectIndex: vi.fn() }),
    );

    act(() => {
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowDown'));
      result.current.handleInputKeyDown(makeKeyboardEvent('Escape'));
    });

    expect(result.current.activeIndex).toBeNull();
  });

  it('clamps activeIndex when result count shrinks', () => {
    const { result, rerender } = renderHook(
      ({ resultCount }) => useSearchResultsKeyboard({ resultCount, onSelectIndex: vi.fn() }),
      { initialProps: { resultCount: 3 } },
    );

    act(() => {
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowDown'));
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowDown'));
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowDown'));
    });
    expect(result.current.activeIndex).toBe(2);

    rerender({ resultCount: 1 });
    expect(result.current.activeIndex).toBe(0);
  });

  it('clears activeIndex when result count becomes zero', () => {
    const { result, rerender } = renderHook(
      ({ resultCount }) => useSearchResultsKeyboard({ resultCount, onSelectIndex: vi.fn() }),
      { initialProps: { resultCount: 3 } },
    );

    act(() => {
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowDown'));
    });
    expect(result.current.activeIndex).toBe(0);

    rerender({ resultCount: 0 });
    expect(result.current.activeIndex).toBeNull();
  });

  it('resetHighlight clears activeIndex', () => {
    const { result } = renderHook(() =>
      useSearchResultsKeyboard({ resultCount: 3, onSelectIndex: vi.fn() }),
    );

    act(() => {
      result.current.handleInputKeyDown(makeKeyboardEvent('ArrowDown'));
      result.current.resetHighlight();
    });

    expect(result.current.activeIndex).toBeNull();
  });
});

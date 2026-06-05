import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeckBuilderContextMenu } from '@/components/deckbuilder/DeckBuilderContextMenu';

describe('DeckBuilderContextMenu', () => {
  it('should_render_card_name_and_action_labels', () => {
    render(
      <DeckBuilderContextMenu
        cardName="Lightning Bolt"
        pageX={100}
        pageY={200}
        actions={[
          { label: 'Add to main deck', onAction: vi.fn() },
          { label: 'Add to sideboard', onAction: vi.fn() },
        ]}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to main deck' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to sideboard' })).toBeInTheDocument();
  });

  it('should_call_onAction_when_enabled_button_clicked', () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();

    render(
      <DeckBuilderContextMenu
        cardName="Lightning Bolt"
        pageX={100}
        pageY={200}
        actions={[{ label: 'Add to main deck', onAction }]}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add to main deck' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('should_not_call_onAction_when_disabled_button_clicked', () => {
    const onAction = vi.fn();

    render(
      <DeckBuilderContextMenu
        cardName="Lightning Bolt"
        pageX={100}
        pageY={200}
        actions={[{ label: 'Add to main deck', onAction, disabled: true }]}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add to main deck' }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('should_call_onDismiss_when_escape_pressed', () => {
    const onDismiss = vi.fn();

    render(
      <DeckBuilderContextMenu
        cardName="Lightning Bolt"
        pageX={100}
        pageY={200}
        actions={[{ label: 'Add to main deck', onAction: vi.fn() }]}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should_call_onDismiss_when_clicking_outside_menu', () => {
    const onDismiss = vi.fn();

    render(
      <>
        <div data-testid="outside">Outside</div>
        <DeckBuilderContextMenu
          cardName="Lightning Bolt"
          pageX={100}
          pageY={200}
          actions={[{ label: 'Add to main deck', onAction: vi.fn() }]}
          onDismiss={onDismiss}
        />
      </>,
    );

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

export function focusAndSelectInput(input: HTMLInputElement | null): void {
  if (!input) {
    return;
  }

  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

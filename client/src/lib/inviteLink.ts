export function buildInviteJoinUrl(token: string, origin = window.location.origin) {
  return `${origin}/join?token=${token}`;
}

export async function copyTextToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

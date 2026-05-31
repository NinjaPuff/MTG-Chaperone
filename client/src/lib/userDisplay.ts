type UserLike = {
  displayName: string;
  publicName?: string | null;
  discordHandle?: string | null;
};

export function primaryName(user: UserLike): string {
  return user.publicName || user.displayName;
}

export function secondaryName(user: UserLike): string | null {
  return user.publicName ? user.displayName : null;
}

/** Raw stored value — use on ProfilePage preview so users see what they saved. */
export function discordHandleRaw(user: UserLike): string | null {
  const handle = user.discordHandle?.trim();
  return handle || null;
}

/** Public subtitle — suppress when handle duplicates OAuth displayName. */
export function discordHandleText(user: UserLike): string | null {
  const handle = discordHandleRaw(user);
  if (!handle) return null;
  if (handle.toLowerCase() === user.displayName.toLowerCase()) return null;
  return handle;
}

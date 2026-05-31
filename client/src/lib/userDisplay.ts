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

/** Subtitle for user lists: account name when using a public alias, otherwise discord handle. */
export function profileSubtitle(user: UserLike): string | null {
  const secondary = secondaryName(user);
  const subtitle = secondary ?? discordHandleRaw(user);
  if (!subtitle || subtitle === primaryName(user)) {
    return null;
  }
  return subtitle;
}

/** Public subtitle — show whenever a discord handle is stored. */
export function discordHandleText(user: UserLike): string | null {
  return discordHandleRaw(user);
}

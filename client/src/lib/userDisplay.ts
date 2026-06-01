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

/** Subtitle for user lists: discord handle when set, otherwise OAuth account name for aliased users. */
export function profileSubtitle(user: UserLike): string | null {
  const primary = primaryName(user);
  const handle = discordHandleRaw(user);
  if (handle && handle !== primary) {
    return handle;
  }
  const secondary = secondaryName(user);
  if (secondary && secondary !== primary) {
    return secondary;
  }
  return null;
}

/** Public subtitle — show whenever a discord handle is stored. */
export function discordHandleText(user: UserLike): string | null {
  return discordHandleRaw(user);
}

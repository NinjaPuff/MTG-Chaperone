type UserLike = {
  displayName: string;
  publicName?: string | null;
};

export function primaryName(user: UserLike): string {
  return user.publicName || user.displayName;
}

export function secondaryName(user: UserLike): string | null {
  return user.publicName ? user.displayName : null;
}

import type { ReactNode } from 'react';

type PoolOwnerEditLayoutProps = {
  isOwner: boolean;
  isAdmin: boolean;
  addCardsForm: ReactNode;
  stagedChangesPanel: ReactNode;
};

export function PoolOwnerEditLayout({ isOwner, isAdmin, addCardsForm, stagedChangesPanel }: PoolOwnerEditLayoutProps) {
  return (
    <>
      {isOwner ? addCardsForm : null}
      {isOwner || isAdmin ? stagedChangesPanel : null}
    </>
  );
}

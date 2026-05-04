import { useState, type DragEvent, type PropsWithChildren } from 'react';

type DropZoneProps = PropsWithChildren<{
  className?: string;
  activeClassName?: string;
  disabled?: boolean;
  onDropCard?: (event: DragEvent<HTMLDivElement>) => void;
}>;

export function DropZone({ children, className, activeClassName, disabled = false, onDropCard }: DropZoneProps) {
  const [isActive, setIsActive] = useState(false);

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    event.preventDefault();
    setIsActive(true);
  };

  const onDragLeave = () => {
    setIsActive(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    setIsActive(false);
    if (disabled) {
      return;
    }
    event.preventDefault();
    onDropCard?.(event);
  };

  return (
    <div
      className={`${className ?? ''} ${isActive ? activeClassName ?? 'ring-2 ring-primary/70' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
    </div>
  );
}


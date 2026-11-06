import type { ReactNode } from 'react';

export function Placeholder({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: string;
  children?: ReactNode;
}) {
  return (
    <section className="stack">
      <h1>
        {icon && <span aria-hidden="true">{icon} </span>}
        {title}
      </h1>
      {children}
    </section>
  );
}

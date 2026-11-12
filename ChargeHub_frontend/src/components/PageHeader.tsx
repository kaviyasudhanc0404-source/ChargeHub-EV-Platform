import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
}

// Title block at the top of every panel page
const PageHeader = ({ title, description, eyebrow, actions }: PageHeaderProps) => (
  <header className="enter flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {eyebrow && <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>}
      <h1 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
      {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2 sm:justify-end [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>}
  </header>
);

export default PageHeader;

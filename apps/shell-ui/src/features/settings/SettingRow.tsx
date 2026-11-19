import type { ReactNode } from 'react';

interface SettingRowProps {
  title: string;
  description: string;
  children: ReactNode;
  /** Stack the control under the text (for wide controls such as card groups). */
  stacked?: boolean;
}

export function SettingRow({ title, description, children, stacked = false }: SettingRowProps) {
  return (
    <div
      className={
        stacked
          ? 'flex flex-col gap-4 py-6'
          : 'flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between'
      }
    >
      <div className="max-w-md space-y-1">
        <h3 className="text-[15px] font-bold">{title}</h3>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

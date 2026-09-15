import type { KeyboardEvent } from 'react';

interface Props<T extends string> {
  value: T;
  options: readonly { key: T; label: string }[];
  onChange: (key: T) => void;
  ariaLabel: string;
}

/** ラジオ群の見た目と操作（矢印キー移動・選択中だけ Tab 停止）を 1 箇所に持つ */
export function SegmentedControl<T extends string>({ value, options, onChange, ariaLabel }: Props<T>) {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.key === value);
    const next = options[(i + delta + options.length) % options.length]!;
    onChange(next.key);
    (e.currentTarget.parentElement?.children[options.indexOf(next)] as HTMLElement | undefined)?.focus();
  };
  return (
    <div className="toggle" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.key} type="button" role="radio" aria-checked={value === o.key} tabIndex={value === o.key ? 0 : -1}
                className="toggle-item" onClick={() => onChange(o.key)} onKeyDown={onKeyDown}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

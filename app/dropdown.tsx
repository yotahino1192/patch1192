"use client";

import { useEffect, useId, useRef, useState } from "react";

export type DropdownOption = { value: string; label: string; flag?: string };
export function Dropdown({ label, value, options, onChange, className = "", disabled = false }: {
  label: string; value: string; options: DropdownOption[]; onChange: (value: string) => void; className?: string; disabled?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = Math.max(0, options.findIndex((item) => item.value === value));
  const choice = options[selected];
  const reveal = () => { setActive(selected); setOpen(true); };
  const choose = (index: number) => { if (options[index]) onChange(options[index].value); setOpen(false); };
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => { if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active, open, id]);
  return <div ref={root} className={`app-dropdown ${className}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <span id={`${id}-label`} className="dropdown-label">{label}</span>
    <button type="button" className="dropdown-trigger" role="combobox" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled} onClick={() => open ? setOpen(false) : reveal()} onKeyDown={(event) => {
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        if (!open) reveal();
        else setActive(event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (active + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
      } else if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (open) choose(active); else reveal(); }
      else if (event.key === "Tab") setOpen(false);
    }}>
      {choice?.flag && <span className="dropdown-flag" aria-hidden="true">{choice.flag}</span>}
      <span id={`${id}-value`}>{choice?.label}</span><span className="dropdown-chevron" aria-hidden="true" />
    </button>
    {open && <ul id={`${id}-list`} className="dropdown-options" role="listbox" aria-labelledby={`${id}-label`}>{options.map((option, index) => <li id={`${id}-${index}`} key={option.value} role="option" aria-selected={value === option.value} className={index === active ? "highlighted" : ""} onPointerMove={() => setActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
      {option.flag && <span className="dropdown-flag" aria-hidden="true">{option.flag}</span>}<span>{option.label}</span>{value === option.value && <span className="dropdown-check" aria-hidden="true">✓</span>}
    </li>)}</ul>}
  </div>;
}

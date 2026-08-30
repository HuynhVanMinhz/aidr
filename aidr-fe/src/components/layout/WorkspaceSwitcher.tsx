import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Workspace } from '../../hooks/useRoles';

type Props = {
  workspaces: Workspace[];
};

/**
 * The way out of the storefront and into a seller or admin workspace.
 *
 * These used to be plain nav items sitting between "Categories" and "My
 * Account", which put a whole other application on the same footing as a
 * product listing. A single labelled control keeps the nav about shopping and
 * makes the switch obvious to the accounts that have one.
 */
export function WorkspaceSwitcher({ workspaces }: Props) {
  const [open, setOpen] = useState(false);
  const single = workspaces.length === 1 ? workspaces[0] : null;

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.store-workspace-switcher')) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  if (workspaces.length === 0) return null;

  // One role is the common case; a dropdown holding a single item is a click
  // charged for nothing.
  if (single) {
    return (
      <Link to={single.to} className="store-workspace-btn" title={single.label}>
        <i className={single.icon} aria-hidden />
        <span>{single.label}</span>
      </Link>
    );
  }

  return (
    <div className={`store-workspace-switcher${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="store-workspace-btn"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <i className="fa-solid fa-grip" aria-hidden />
        <span>Workspaces</span>
        <i className="fa-solid fa-chevron-down store-workspace-btn__caret" aria-hidden />
      </button>

      {open ? (
        <div className="store-workspace-menu" role="menu">
          {workspaces.map((workspace) => (
            <Link key={workspace.to} to={workspace.to} onClick={() => setOpen(false)} role="menuitem">
              <i className={workspace.icon} aria-hidden />
              {workspace.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

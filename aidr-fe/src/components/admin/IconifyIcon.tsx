import { createElement } from 'react';

type IconifyIconProps = {
  icon: string;
  className?: string;
};

export function IconifyIcon({ icon, className }: IconifyIconProps) {
  return createElement('iconify-icon', { icon, class: className, className });
}

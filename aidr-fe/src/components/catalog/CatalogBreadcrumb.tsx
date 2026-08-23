import { Link } from 'react-router-dom';

type Crumb = { label: string; to?: string };

type Props = {
  items: Crumb[];
};

/** Theme breadcrumb markup (page-header / product-single). */
export function CatalogBreadcrumb({ items }: Props) {
  return (
    <nav>
      <ol className="breadcrumb">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className={`breadcrumb-item${isLast ? ' active' : ''}`}
              aria-current={isLast ? 'page' : undefined}
            >
              {item.to && !isLast ? <Link to={item.to}>{item.label}</Link> : item.label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

"use client";

/**
 * CategoryTabs — horizontal rule of category filters with counts.
 *
 * Looks like a newspaper section navigation. Active category gets a
 * thick copper underline; inactives get a thin rule of the dust-shadow
 * color. On overflow (wider than viewport), horizontal scroll is
 * enabled with the rail visually hinted by a fade mask on the right
 * edge. Each tab is a real <button> for accessibility; Tab order
 * matches visual order.
 */

interface Category {
  name: string;
  count: number;
}

interface Props {
  categories: Category[];
  active: string;
  onChange: (name: string) => void;
}

export function CategoryTabs({ categories, active, onChange }: Props) {
  return (
    <nav
      aria-label="Filter by category"
      className="relative overflow-x-auto pb-2 ed-enter ed-d-6"
      style={{
        maskImage: "linear-gradient(to right, black 85%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to right, black 85%, transparent 100%)",
      }}
    >
      <ul className="flex items-end gap-x-8 min-w-max pt-6 border-t" style={{ borderColor: "var(--ed-rule)" }}>
        {categories.map((cat) => {
          const isActive = cat.name === active;
          return (
            <li key={cat.name} className="flex-shrink-0">
              <button
                type="button"
                onClick={() => onChange(cat.name)}
                className="group relative pb-3 flex items-baseline gap-2 transition-colors outline-none"
                style={{
                  color: isActive ? "var(--ed-ink)" : "var(--ed-ink-dim)",
                }}
                aria-pressed={isActive}
              >
                <span className={isActive ? "ed-display" : "ed-body"}
                      style={{ fontSize: isActive ? "1.35rem" : "1rem", lineHeight: 1 }}>
                  {cat.name}
                </span>
                <span className="ed-caption" style={{ opacity: isActive ? 1 : 0.6 }}>
                  {String(cat.count).padStart(3, "0")}
                </span>

                {/* Active underline — copper, chunky */}
                {isActive && (
                  <span
                    className="absolute left-0 right-0 -bottom-[1px] h-[2px]"
                    style={{ background: "var(--ed-copper)" }}
                  />
                )}

                {/* Hover underline — dust color, appears on hover if not active */}
                {!isActive && (
                  <span
                    className="absolute left-0 right-0 -bottom-[1px] h-[1px] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
                    style={{ background: "var(--ed-ink-dim)" }}
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

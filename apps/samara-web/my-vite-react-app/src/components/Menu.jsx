// A single, reusable menu builder
export default function Menu({
  items = [],
  className = "",
  itemClassName = "",
  linkClassName = "",
}) {
  return (
    <ul className={["menu", className].filter(Boolean).join(" ")}>
      {items.map((it) => (
        <li
          key={it.href ?? it.label}
          className={["menu__item", itemClassName, it.css].filter(Boolean).join(" ")}
          data-id={it.id}
          data-test={it.testid}
        >
          <a
            href={it.href || "#"}
            className={["menu__link", linkClassName].filter(Boolean).join(" ")}
            aria-label={it.ariaLabel || it.label}
            onClick={it.onClick}
          >{/* icon can be a string (URL, emoji) or a React element */}
{it.icon ? (
  typeof it.icon === "string" ? (
    <img
      src={it.icon}
      alt={it.label || "icon"}
      className="menu__icon-img"
      style={{ width: "18px", height: "18px", verticalAlign: "middle", marginRight: "0.4rem" }}
    />
  ) : (
    <span className="menu__icon">{it.icon}</span>
  )
) : null}

            <span className="menu__label">{it.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

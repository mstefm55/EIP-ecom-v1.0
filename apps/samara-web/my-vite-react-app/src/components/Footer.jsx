export default function Footer({ links = [] }) {
  return (
    <footer className="site-footer">
      <ul className="footer__links">
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href}>{l.label}</a>
          </li>
        ))}
      </ul>
      <small>© {new Date().getFullYear()} Samara</small>
    </footer>
  );
}

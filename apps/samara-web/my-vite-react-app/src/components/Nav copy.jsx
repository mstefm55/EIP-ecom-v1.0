import logo from "../assets/samara logo.png";
import Menu from "./Menu";

export default function Nav({
  mainItems = [],
  utilItems = [],
  onLogoClick,
}) {
  return (
    <nav className="site-nav" aria-label="Primary">
      {/* Left: brand */}
      <div className="site-nav__zone site-nav__zone--left">
        <a href="/" aria-label="Home" onClick={onLogoClick} className="brand">
          <img src={logo} alt="Samara" className="brand__img" style={{height:"70px", width:"auto"}}/>
        </a>
      </div>

      {/* Center: main menu */}
      <div className="site-nav__zone site-nav__zone--center">
        <Menu items={mainItems} className="menu--center" linkClassName="menu--center__link" />
      </div>

      {/* Right: utilities */}
      <div className="site-nav__zone site-nav__zone--right">
        <Menu items={utilItems} className="menu--right" linkClassName="menu--right__link" />
      </div>
    </nav>
  );
}

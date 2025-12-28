import { useState, useCallback, useMemo } from "react";
import "./App.css";

import Nav from "./components/Nav";
import Header from "./components/Header";
import Main from "./components/Main";
import Footer from "./components/Footer";
import Button from "./components/Button";
import Sidebar from "./components/Sidebar";
import FeaturesSketchbook from "./components/FeaturesSketchbook";
import FeaturesAtelierBoard from "./components/FeaturesAtelierBoard";
import FeaturesMagazinePages from "./components/FeaturesMagazinePages";
import FeaturedCoverflow from "./components/FeaturedCoverflow";
import { BRAND, NAV_ITEMS, NAV_UTILITIES, FOOTER_LINKS, SIDEBAR_SECTIONS} from "./config/navigation";
import DepthCards from "./components/DepthCards";

const cards = [
  {
    id: "hero",
    image: "/assets/hero/pexels-alipazani-12513869.jpg",
    kicker: "FEATURED",
    title: "Community Reviews",
    desc: "Trusted by makers worldwide.",
  },
  {
    id: "c1",
    image: "/assets/hero/pexels-aydin-sefidi-41034179-12367369.jpg",
    kicker: "ATELIER",
    title: "Pattern Drops",
    desc: "New releases and sizing notes.",
  },
  {
    id: "c2",
    image: "/assets/hero/pexels-eliasdecarvalho-1144834.jpg",
    kicker: "EDITORIAL",
    title: "Maker Stories",
    desc: "Behind the scenes.",
  },
  {
    id: "c3",
    image: "/assets/hero/pexels-olly-837140.jpg",
    kicker: "PATTERNS",
    title: "Construction Notes",
    desc: "Professional finishing.",
  },
  {
    id: "c4",
    image: "/assets/hero/slide1.jpg",
    kicker: "COURSES",
    title: "Skill Building",
    desc: "Learn the craft.",
  },
]
;export default function App() {
  const [cartCount, setCartCount] = useState(0);
  const [language, setLanguage] = useState("EN");
  const handleLanguageChange = useCallback((e) => {
    setLanguage(e.target.value);
  }, []);
  const handlers = useMemo(() => ({ handleLanguageChange }), [handleLanguageChange]);

  // example sidebar switches (owned by App; easy to pass to APIs later)
  const [onlyFree, setOnlyFree] = useState(false);
  const [onlySale, setOnlySale] = useState(false);
  const [inStock, setInStock]   = useState(true);
  const [isAdministrator, setIsAdministrator] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const sidebarState = { language, onlyFree, onlySale, inStock };

  return (
    <>
      <Nav
      containerTag="div"                 
      containerClass="site-nav"          
      brandDesc={BRAND}
      mainItems={NAV_ITEMS}
      utilItems={NAV_UTILITIES}
      language={language}
      handlers={handlers}
    />
  
      
<div className="layout">
      
      <Sidebar
          sections={SIDEBAR_SECTIONS}
          state={sidebarState}
          handlers={{
            ...handlers,
            // you can add more handlers later, e.g. for the checkboxes:
            // toggleOnlyFree: () => setOnlyFree(v => !v),
          }}
        />
      <Main >
        <Header title="Welcome to Samara" />
         <FeaturesAtelierBoard />
        <FeaturesMagazinePages />
        <FeaturedCoverflow />
      <Button label="Click me" action="/example-endpoint" css="btn btn--primary" />
        <p style={{ padding: "1rem" }}>
          Your landing/admin/e-commerce pages can all reuse Nav/Header/Main/Footer.
        </p>
        
        <button onClick={() => setCartCount((c) => c + 1)}>Add to cart ({cartCount})</button>
      </Main>

     
        </div>
     <Footer links={FOOTER_LINKS} />
    </>
  );
}

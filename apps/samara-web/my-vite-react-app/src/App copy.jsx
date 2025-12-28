// src/App.jsx
import { useState, useMemo, useCallback } from "react";
import Nav from "./components/Nav";
import Header from "./components/Header";
import Main from "./components/Main";
import Footer from "./components/Footer";
// If your footer is still plain links, keep its own config file; otherwise convert it to descriptors later.
import { BRAND, NAV_ITEMS, NAV_UTILITIES } from "./navigation";
import { FOOTER_LINKS } from "./config"; // or wherever your footer data lives
import "./styles.css";

export default function App() {
  const [language, setLanguage] = useState("EN");
  const handleLanguageChange = useCallback((e) => setLanguage(e.target.value), []);
  const handlers = useMemo(() => ({ handleLanguageChange }), [handleLanguageChange]);

  // other state you actually use (example kept for later use)
  const [cartCount, setCartCount] = useState(0);

  return (
    <>
      <Nav
        brandDesc={BRAND}
        mainItems={NAV_ITEMS}
        utilItems={NAV_UTILITIES}
        language={language}
        handlers={handlers}
      />

      <Header title="Welcome to Samara" />

      <Main>
        {/* Keep Main children real UI, not demo language echoing */}
        {/* Example: <Button label="Shop now" action="/shop" css="btn btn--primary" /> */}
        {/* Example: <button onClick={() => setCartCount((c) => c + 1)}>Add to cart ({cartCount})</button> */}
      </Main>

      <Footer links={FOOTER_LINKS} />
    </>
  );
}

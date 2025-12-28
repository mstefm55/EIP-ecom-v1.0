// src/components/Header.jsx
import React from "react";
import Carousel from "./Carousel";
import { CAROUSEL_SLIDES } from "../config/navigation";

export default function Header({
  title = "Welcome to Samara",
  intervalMs = 5000,
  slides = CAROUSEL_SLIDES,
  ariaLabel = "Samara highlights",
}) {
  return (
    <header className="header">
      {title && <h1 className="visually-hidden">{title}</h1>}
      <Carousel 
        intervalMs={intervalMs}
        slides={slides}
        ariaLabel={ariaLabel}
      />
    </header>
  );
}
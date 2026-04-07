import { useEffect } from "react";
import { useLocation } from "react-router";

export function ScrollRestoration() {
  const location = useLocation();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [location.pathname, reduceMotion]);

  return null;
}

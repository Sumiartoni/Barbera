"use client";
import { useEffect } from "react";

/**
 * Custom scissors cursor using base64-encoded SVGs for maximum browser compatibility.
 * - CLOSED by default, oriented top-left like a normal Windows cursor
 * - OPENS when hovering over clickable elements
 */

function svgToBase64(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Closed scissors â€” blades together, tip pointing top-left
const closedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M4 2 L16 14" stroke="#1a1a1a" stroke-width="2.5" stroke-linecap="round"/><path d="M3 3 L15 15" stroke="#888888" stroke-width="1" stroke-linecap="round" opacity="0.3"/><path d="M2 6 L14 16" stroke="#1a1a1a" stroke-width="2.5" stroke-linecap="round"/><circle cx="15" cy="15" r="2.5" fill="#DC2626"/><circle cx="15" cy="15" r="1.2" fill="#ffffff"/><path d="M15 15 L24 24" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="26" cy="26" rx="3.5" ry="2.8" transform="rotate(45 26 26)" fill="none" stroke="#DC2626" stroke-width="2"/><path d="M15 15 L26 20" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="28" cy="21" rx="3.5" ry="2.8" transform="rotate(20 28 21)" fill="none" stroke="#DC2626" stroke-width="2"/><path d="M4 2 L6 4" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity="0.5"/></svg>`;

// Open scissors â€” blades spread apart
const openSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M2 1 L14 13" stroke="#1a1a1a" stroke-width="2.5" stroke-linecap="round"/><path d="M1 2 L13 14" stroke="#888888" stroke-width="1" stroke-linecap="round" opacity="0.3"/><path d="M1 10 L13 16" stroke="#1a1a1a" stroke-width="2.5" stroke-linecap="round"/><path d="M2 1 L4 3" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity="0.5"/><path d="M1 10 L3 11" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity="0.4"/><circle cx="14" cy="15" r="3" fill="#DC2626"/><circle cx="14" cy="15" r="1.4" fill="#ffffff"/><path d="M14 15 L23 24" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="25" cy="26" rx="3.5" ry="2.8" transform="rotate(45 25 26)" fill="none" stroke="#DC2626" stroke-width="2"/><path d="M14 15 L25 20" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="27" cy="21" rx="3.5" ry="2.8" transform="rotate(20 27 21)" fill="none" stroke="#DC2626" stroke-width="2"/></svg>`;

const CustomCursor = () => {
  useEffect(() => {
    // Skip on touch devices
    if (
      window.matchMedia("(pointer: coarse)").matches ||
      "ontouchstart" in window
    ) {
      return;
    }

    const closedUrl = svgToBase64(closedSvg);
    const openUrl = svgToBase64(openSvg);

    const style = document.createElement("style");
    style.id = "custom-scissors-cursor";

    style.textContent = `
*, *::before, *::after {
  cursor: url("${closedUrl}") 3 2, auto !important;
}
a, a *,
button, button *,
[role="button"], [role="button"] *,
[onclick], [onclick] *,
label[for], label[for] *,
input[type="submit"], input[type="button"], input[type="reset"],
select, summary,
[data-cursor-hover], [data-cursor-hover] * {
  cursor: url("${openUrl}") 3 2, pointer !important;
}
`;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);

  return null;
};

export default CustomCursor;

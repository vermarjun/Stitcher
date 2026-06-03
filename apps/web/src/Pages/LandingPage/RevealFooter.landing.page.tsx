import React from "react";

/**
 * RevealFooter — "motion footer" sticky reveal.
 *
 * The children (footer CTA + footer) are pinned to the bottom of the viewport
 * with `position: fixed`, filling exactly one screen, while a same-height spacer
 * sits in the normal scroll flow. A `clip-path` on the spacer clips the fixed
 * footer to the spacer's box, so the footer stays hidden until you scroll to the
 * very bottom — then the preceding content "lifts away" to reveal the footer
 * underneath it.
 *
 * Why clip-path (and not transform/filter): clip-path clips a fixed descendant
 * without becoming its containing block, so the footer remains viewport-pinned
 * and the reveal works inside the landing page's custom `overflow-y-scroll`
 * container too. The panel is `h-screen` to match that container, so the reveal
 * completes exactly when the footer fully fills the viewport (no clipping of the
 * CTA's top edge, which a taller-than-viewport panel would cause).
 *
 * Layout: children are laid out as a flex column with `justify-between`, so the
 * first child (CTA) occupies the upper area and the last child (Footer) sits at
 * the bottom of the screen — mirroring the reference component's structure.
 */
const RevealFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div
      className="relative h-screen w-full"
      // clip-path confines the fixed footer to this spacer's box → reveal.
      style={{ clipPath: "inset(0)" }}
    >
      {/* z-10 keeps the footer below the navbar (z-50) and creates a stacking
          context so the CTA's internal z-indexes stay contained. */}
      <div className="fixed bottom-0 left-0 z-10 flex h-screen w-full flex-col justify-between overflow-hidden bg-black">
        {children}
      </div>
    </div>
  );
};

export default RevealFooter;

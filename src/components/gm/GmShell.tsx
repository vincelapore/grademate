import type { ReactNode } from "react";
import { GmFooter } from "./GmFooter";
import { GmNav, type GmNavVariant } from "./GmNav";

export function GmShell({
  variant,
  children,
  showFooter = true,
  showNav = true,
}: {
  variant: GmNavVariant;
  children: ReactNode;
  showFooter?: boolean;
  showNav?: boolean;
}) {
  return (
    <div className="gm-wrap">
      {showNav ? <GmNav variant={variant} /> : null}
      {children}
      {showFooter ? <GmFooter /> : null}
    </div>
  );
}


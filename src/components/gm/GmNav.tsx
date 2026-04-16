import Link from "next/link";
import { GmLogo } from "./GmLogo";

export type GmNavVariant = "marketing" | "app";

export function GmNav({
  variant,
}: {
  variant: GmNavVariant;
}) {
  return (
    <nav className="gm-nav">
      <GmLogo />
      <div className="gm-nav-links">
        {variant === "marketing" ? (
          <>
            <a className="gm-nav-link" href="#how-it-works">
              How it works
            </a>
            {/* <a className="gm-nav-link" href="#pricing">
              Pricing
            </a> */}
            <Link className="gm-nav-cta" href="/auth/login">
              Get started free
            </Link>
          </>
        ) : (
          <>
            <Link className="gm-nav-cta" href="/auth/login">
              Sign in
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}


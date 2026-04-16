import { GmLogo } from "./GmLogo";
import Link from "next/link";

export function GmFooter() {
  return (
    <footer className="gm-footer">
      <div className="gm-footer-logo">
        <GmLogo href="/" />
      </div>
      <div className="gm-footer-note">
        Built for Australian students · grademate.dev
      </div>
      <div className="gm-footer-note gm-footer-links" aria-label="Legal">
        <Link href="/privacy">Privacy</Link>
        <span aria-hidden> · </span>
        <Link href="/terms">Terms</Link>
      </div>
    </footer>
  );
}


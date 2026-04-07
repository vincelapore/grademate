import { GmLogo } from "./GmLogo";

export function GmFooter() {
  return (
    <footer className="gm-footer">
      <div className="gm-footer-logo">
        <GmLogo href="/" />
      </div>
      <div className="gm-footer-note">
        Built for Australian students · grademate.dev
      </div>
    </footer>
  );
}


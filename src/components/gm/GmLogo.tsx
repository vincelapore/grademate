import Link from "next/link";

export function GmLogo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="gm-logo" aria-label="GradeMate home">
      grade<span>mate</span>
    </Link>
  );
}


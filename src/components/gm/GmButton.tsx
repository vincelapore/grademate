import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "ghost";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "gm-btn-primary",
  ghost: "gm-btn-ghost",
};

export function GmButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      {...props}
      className={[VARIANT_CLASS[variant], className].filter(Boolean).join(" ")}
    />
  );
}

export function GmButtonAnchor({
  variant = "ghost",
  className,
  ...props
}: ComponentProps<"a"> & { variant?: Variant }) {
  return (
    <a
      {...props}
      className={[VARIANT_CLASS[variant], className].filter(Boolean).join(" ")}
    />
  );
}


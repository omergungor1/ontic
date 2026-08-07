"use client";

import Link from "next/link";

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const baseClass =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:bg-zinc-100";

export default function BackButton({
  href,
  onClick,
  label = "Geri",
  className = "",
}) {
  const classes = `${baseClass} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} aria-label={label} className={classes}>
        <ChevronIcon />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={classes}
    >
      <ChevronIcon />
    </button>
  );
}

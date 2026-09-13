"use client";

const IGNORE = [
  "params are being enumerated",
  "The keys of `searchParams` were accessed directly",
];

function isInspectorNoise(args) {
  const first = args[0];
  const text =
    typeof first === "string"
      ? first
      : first && typeof first.message === "string"
        ? first.message
        : "";
  return IGNORE.some((snippet) => text.includes(snippet));
}

let patched = false;

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  if (!patched) {
    patched = true;
    const original = console.error;
    console.error = function (...args) {
      if (isInspectorNoise(args)) return;
      original.apply(console, args);
    };
  }
}

export default function DevInspectGuard() {
  return null;
}

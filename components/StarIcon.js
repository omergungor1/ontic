export default function StarIcon({ className = "h-4 w-4", filled = true }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="m12 3.2 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.3l1-5.8L3.5 9.4l5.9-.9L12 3.2Z"
      />
    </svg>
  );
}

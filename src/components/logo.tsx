// Placeholder wordmark until the real logo exists: a four-point star over
// the brand name.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="flex items-center gap-2 font-semibold tracking-tight">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-6 text-accent drop-shadow-[0_0_6px_var(--accent)]"
        >
          <path
            fill="currentColor"
            d="M12 1.5c.6 5.6 4.9 9.9 10.5 10.5-5.6.6-9.9 4.9-10.5 10.5C11.4 16.9 7.1 12.6 1.5 12 7.1 11.4 11.4 7.1 12 1.5Z"
          />
        </svg>
        <span>
          Astral <span className="text-accent">Tech</span> Gaming
        </span>
      </span>
    </span>
  );
}

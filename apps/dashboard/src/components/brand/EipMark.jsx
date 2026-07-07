export default function EipMark({ className = "", title = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
    >
      {title ? <title>{title}</title> : null}
      <path d="M8 16h16M16 8v16M10.3 10.3l11.4 11.4M21.7 10.3 10.3 21.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 3.8c.65 4.35 2.85 6.55 7.2 7.2-4.35.65-6.55 2.85-7.2 7.2-.65-4.35-2.85-6.55-7.2-7.2 4.35-.65 6.55-2.85 7.2-7.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="5.2" cy="22.6" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="25.8" cy="25.1" r="1.6" fill="currentColor" />
      <path d="m7 21 4.2-3.1M22 21.4l2.7 2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

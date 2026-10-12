/** Remounts on every navigation, so each page fades and rises in (skipped while a view transition runs). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}

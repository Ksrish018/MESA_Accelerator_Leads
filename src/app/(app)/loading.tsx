/** Skeleton shaped like the content, never a full-page spinner (PRD §10.6). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="sk" style={{ height: 290, borderRadius: "0 0 28px 28px" }} />
      <div className="wrap section stack-24">
        <div className="sk" style={{ height: 104 }} />
        {[0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 180, borderRadius: 20 }} />)}
      </div>
    </div>
  );
}

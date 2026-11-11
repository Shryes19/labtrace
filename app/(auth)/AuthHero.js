export default function AuthHero() {
  return (
    <div className="auth-hero">
      <div className="brand" style={{ padding: 0 }}>
        <div className="brand-mark">LT</div>
        <div><div className="brand-name">LabTrace</div><div className="brand-sub">PES University · Lab Maintenance</div></div>
      </div>
      <div>
        <h1>Every lab failure, its repair history and the fix that worked - in one place.</h1>
        <ul>
          <li>Report equipment failures in plain language</li>
          <li>Find similar past failures with semantic (meaning-based) search</li>
          <li>Track assignments, repairs and spare parts end to end</li>
          <li>Spot unreliable assets before they fail again</li>
        </ul>
      </div>
      <div className="small" style={{ color: '#6f7890' }}>PostgreSQL · MongoDB vector search · Next.js</div>
    </div>
  );
}

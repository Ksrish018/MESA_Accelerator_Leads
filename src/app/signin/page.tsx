import { HeroImage } from "@/components/Hero";

export const metadata = { title: "Sign in" };

/** Hero image, product name, password field. Nothing else (PRD §10.3). */
export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="signin">
      <div className="hero">
        <HeroImage slot="signin" priority zoom />
        <div className="hero-scrim" />
      </div>
      <div className="signin-inner reveal">
        <h1 className="display">Funding Radar</h1>
        <form action="/api/auth/signin" method="post">
          <label htmlFor="password" className="sr-only">Password</label>
          <input id="password" name="password" type="password" placeholder="Password" autoComplete="current-password" required autoFocus />
          <button className="btn" type="submit">Sign in</button>
        </form>
        {error ? <p className="err" role="alert">Wrong password.</p> : null}
      </div>
    </main>
  );
}

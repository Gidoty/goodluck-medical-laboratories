"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, getSession } from "next-auth/react";
import { LogIn, Loader2, FlaskConical } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", { email, password, redirect: false });

    if (!res || res.error) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    const session = await getSession();
    const destination =
      callbackUrl ?? (session?.user.role === "ADMIN" ? "/admin" : "/portal");
    router.push(destination);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-7">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Email Address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
          placeholder="••••••••"
        />
      </div>

      {error && <p className="text-sm text-red">{error}</p>}

      <button type="submit" disabled={loading} className="btn btn-primary w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Sign In
      </button>

      <p className="text-center text-sm text-muted">
        Don&rsquo;t have a patient account?{" "}
        <Link href="/register" className="font-semibold text-blue hover:underline">
          Register here
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="section-pad">
      <div className="container-page mx-auto max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue text-white">
            <FlaskConical className="h-6 w-6" />
          </span>
          <h1 className="font-display text-2xl font-extrabold text-navy">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in to your patient or staff account</p>
        </div>
        <Suspense fallback={<div className="card p-7 text-sm text-muted">Loading…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

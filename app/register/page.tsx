"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus, Loader2, FlaskConical } from "lucide-react";
import { registerSchema, RegisterInput } from "@/lib/validations";

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterInput) => {
    setServerError(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    const signInRes = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (signInRes?.error) {
      router.push("/login");
      return;
    }

    router.push("/portal");
    router.refresh();
  };

  return (
    <div className="section-pad">
      <div className="container-page mx-auto max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue text-white">
            <FlaskConical className="h-6 w-6" />
          </span>
          <h1 className="font-display text-2xl font-extrabold text-navy">
            Create your patient account
          </h1>
          <p className="mt-1 text-sm text-muted">
            Access your lab results securely, anytime
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 p-7">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Full Name</label>
            <input
              {...register("name")}
              className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
              placeholder="Jane Doe"
            />
            {errors.name && <p className="mt-1 text-xs text-red">{errors.name.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Email Address</label>
            <input
              {...register("email")}
              type="email"
              className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
              placeholder="you@example.com"
            />
            {errors.email && <p className="mt-1 text-xs text-red">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Phone Number</label>
            <input
              {...register("phone")}
              className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
              placeholder="080..."
            />
            {errors.phone && <p className="mt-1 text-xs text-red">{errors.phone.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Password</label>
            <input
              {...register("password")}
              type="password"
              className="w-full rounded-lg border border-border bg-off px-3.5 py-2.5 text-sm outline-none focus:border-blue"
              placeholder="At least 6 characters"
            />
            {errors.password && <p className="mt-1 text-xs text-red">{errors.password.message}</p>}
          </div>

          {serverError && <p className="text-sm text-red">{serverError}</p>}

          <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create Account
          </button>

          <p className="text-center text-sm text-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-blue hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

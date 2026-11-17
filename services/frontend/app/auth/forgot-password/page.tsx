"use client";

import ThemeLogo from "@/components/shared/theme-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AuthImage from "@/public/assets/images/auth/auth-img.png";
import { ArrowLeft, CheckCircle2, Loader2, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = identifier.trim();
    if (!cleaned) {
      toast.error("Username atau email wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: cleaned }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast.error(data.detail || "Gagal mengajukan permintaan reset password");
        return;
      }
      setSubmittedMsg(
        data.message ||
          "Permintaan reset password telah dicatat. Silakan hubungi admin untuk penetapan password baru."
      );
      toast.success("Permintaan reset password berhasil dikirim");
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 flex flex-wrap min-h-screen">
      <div className="lg:w-1/2 hidden lg:block">
        <div className="flex items-center justify-center h-screen flex-col">
          <Image src={AuthImage} alt="Auth Illustration" className="object-cover w-full h-full" />
        </div>
      </div>

      <div className="lg:w-1/2 w-full py-8 px-6 flex flex-col justify-center">
        <div className="lg:max-w-116 w-full mx-auto">
          <div className="mb-2.5 inline-block max-w-72.5">
            <ThemeLogo />
          </div>
          <h4 className="font-semibold mb-2">Lupa Password</h4>
          <p className="mb-6 text-neutral-500 dark:text-neutral-300 text-sm">
            Masukkan username atau email terdaftar Anda. Permintaan reset akan diteruskan ke Admin di menu Users.
          </p>

          {submittedMsg ? (
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-800 space-y-3">
              <div className="flex items-start gap-2.5 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{submittedMsg}</p>
              </div>
              <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <ArrowLeft className="w-4 h-4" /> Kembali ke Halaman Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <User className="absolute inset-s-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
                <Input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Username atau Email"
                  className="ps-13 pe-4 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700"
                  disabled={submitting}
                  required
                />
              </div>

              <Button type="submit" className="w-full rounded-lg h-13 text-sm" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin h-4.5 w-4.5 mr-2" />
                    Mengirim Permintaan...
                  </>
                ) : (
                  "Ajukan Reset Password"
                )}
              </Button>

              <div className="text-center pt-2">
                <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-300 hover:text-primary">
                  <ArrowLeft className="w-4 h-4" /> Kembali ke Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import type { EnvironmentKind } from "@/lib/types/environment";

const DepthScanner = dynamic(
  () =>
    import("@/components/xr/DepthScanner").then((m) => m.DepthScanner),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-zinc-500">Carregando motor A-Frame…</p>
    ),
  }
);

export default function ScanPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "scan">("form");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EnvironmentKind>("casa");
  const [description, setDescription] = useState("");

  if (step === "scan") {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="mb-4 text-2xl font-bold">{name}</h1>
          <DepthScanner
            name={name}
            kind={kind}
            description={description || undefined}
            onSaved={(id) => router.push(`/view/${id}`)}
            onCancel={() => setStep("form")}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppHeader />
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-2xl font-bold">Novo mapa</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Informe o ambiente antes de abrir a câmera AR.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) setStep("scan");
          }}
        >
          <label className="block text-sm">
            <span className="text-zinc-300">Nome</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-emerald-600"
              placeholder="Ex.: Sala principal, Loja centro"
            />
          </label>

          <label className="block text-sm">
            <span className="text-zinc-300">Tipo</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as EnvironmentKind)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3"
            >
              <option value="casa">Casa</option>
              <option value="loja">Loja</option>
              <option value="ambiente">Outro ambiente</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-zinc-300">Descrição (opcional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3"
              placeholder="Notas sobre o espaço"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-500"
          >
            Continuar para scanner
          </button>
        </form>
      </main>
    </div>
  );
}

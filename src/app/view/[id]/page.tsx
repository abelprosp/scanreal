"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { downloadAIExport } from "@/lib/scan/ai-export";
import { getEnvironment } from "@/lib/storage/environments";
import type { MappedEnvironment } from "@/lib/types/environment";

const PointCloudViewer = dynamic(
  () =>
    import("@/components/xr/PointCloudViewer").then((m) => m.PointCloudViewer),
  { ssr: false, loading: () => <p className="text-zinc-500">Carregando vistas…</p> }
);

export default function ViewEnvironmentPage() {
  const params = useParams<{ id: string }>();
  const [env, setEnv] = useState<MappedEnvironment | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    getEnvironment(params.id).then((data) => {
      if (data) setEnv(data);
      else setMissing(true);
    });
  }, [params.id]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        {missing && (
          <div className="text-center">
            <p className="text-zinc-400">Mapa não encontrado.</p>
            <Link href="/" className="mt-4 inline-block text-emerald-400">
              Voltar ao início
            </Link>
          </div>
        )}

        {env && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">{env.name}</h1>
                <p className="mt-1 text-sm text-zinc-500">
                  {env.pointCount.toLocaleString("pt-BR")} pontos
                  {env.quality && (
                    <>
                      {" "}
                      · qualidade IA: {env.quality.score}%
                      {env.quality.readyForAI ? " ✓" : ""}
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => downloadAIExport(env)}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
              >
                Exportar JSON para IA
              </button>
            </div>

            <div className="mt-6">
              <PointCloudViewer environment={env} />
            </div>

            <p className="mt-4 text-sm text-zinc-500">
              Revise as 4 vistas (3D, planta, frente, lateral) antes de enviar o JSON à sua IA.
              O arquivo inclui pontos 3D, planta baixa, dimensões e notas de qualidade.
            </p>

            <Link
              href="/"
              className="mt-6 inline-block rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
            >
              ← Voltar
            </Link>
          </>
        )}
      </main>
    </div>
  );
}

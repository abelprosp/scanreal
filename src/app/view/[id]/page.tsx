"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { getEnvironment } from "@/lib/storage/environments";
import type { MappedEnvironment } from "@/lib/types/environment";

const PointCloudViewer = dynamic(
  () =>
    import("@/components/xr/PointCloudViewer").then((m) => m.PointCloudViewer),
  { ssr: false, loading: () => <p className="text-zinc-500">Carregando 3D…</p> }
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
            <h1 className="text-2xl font-bold">{env.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {env.pointCount.toLocaleString("pt-BR")} pontos · depth:{" "}
              {env.depthMode}
            </p>

            <div className="mt-6">
              <PointCloudViewer environment={env} />
            </div>

            <p className="mt-4 text-sm text-zinc-500">
              Navegação: arraste para orbitar, scroll para zoom, teclas WASD + Q/E
              para mover o foco.
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

import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { DeviceSupportBadge } from "@/components/DeviceSupportBadge";
import { EnvironmentList } from "@/components/EnvironmentList";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <section className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
            Mapeamento de ambientes no navegador
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-zinc-400">
            Escaneie casas, lojas ou salas com a <strong className="text-zinc-200">câmera do celular</strong>.
            Funciona em <strong className="text-zinc-200">iPhone e Android</strong> (Chrome, Safari).
            Visualize o mapa 3D com <strong className="text-zinc-200">Three.js</strong> — sem instalar app.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/scan"
              className="rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white hover:bg-emerald-500"
            >
              Criar novo mapa
            </Link>
          </div>
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-2">
          <DeviceSupportBadge />
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
            <h2 className="font-medium text-zinc-200">Como funciona</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Escaneie com giro 360° + passos pelo ambiente.</li>
              <li>Aguarde a barra de qualidade para IA ficar verde (65%+).</li>
              <li>Revise 3D, planta, frente e lateral.</li>
              <li>Exporte o JSON e envie à sua IA para avaliação.</li>
            </ol>
            <p className="mt-3 text-xs text-emerald-200/80">
              iPhone e Android suportados — câmera + sensores de movimento.
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold">Ambientes salvos</h2>
          <EnvironmentList />
        </section>
      </main>
    </div>
  );
}

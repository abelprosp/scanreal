"use client";

import Link from "next/link";
import type { MappedEnvironment } from "@/lib/types/environment";

const KIND_LABEL: Record<MappedEnvironment["kind"], string> = {
  casa: "Casa",
  loja: "Loja",
  ambiente: "Ambiente",
};

export function EnvironmentCard({ env }: { env: MappedEnvironment }) {
  const date = new Date(env.updatedAt).toLocaleString("pt-BR");

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-600">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-zinc-50">{env.name}</h3>
          <p className="text-xs text-zinc-500">
            {KIND_LABEL[env.kind]} · {date}
          </p>
        </div>
        <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
          {env.depthMode === "motion"
            ? "câmera+motion"
            : env.depthMode === "none"
              ? "estimativa"
              : env.depthMode}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        {env.pointCount.toLocaleString("pt-BR")} pontos 3D
      </p>
      {env.description ? (
        <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{env.description}</p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <Link
          href={`/view/${env.id}`}
          className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          Navegar em 3D
        </Link>
      </div>
    </article>
  );
}

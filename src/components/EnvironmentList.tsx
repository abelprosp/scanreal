"use client";

import { useCallback, useEffect, useState } from "react";
import { EnvironmentCard } from "@/components/EnvironmentCard";
import { deleteEnvironment, listEnvironments } from "@/lib/storage/environments";
import type { MappedEnvironment } from "@/lib/types/environment";

export function EnvironmentList() {
  const [items, setItems] = useState<MappedEnvironment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await listEnvironments();
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este mapa?")) return;
    await deleteEnvironment(id);
    refresh();
  };

  if (loading) {
    return <p className="text-sm text-zinc-500">Carregando mapas…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 p-8 text-center">
        <p className="text-zinc-400">Nenhum ambiente mapeado ainda.</p>
        <p className="mt-1 text-sm text-zinc-500">
          Use &quot;Novo mapa&quot; no iPhone ou Android — permita câmera e sensores de movimento.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((env) => (
        <div key={env.id} className="relative">
          <EnvironmentCard env={env} />
          <button
            type="button"
            onClick={() => handleDelete(env.id)}
            className="absolute right-3 top-3 text-xs text-zinc-600 hover:text-red-400"
            aria-label="Excluir"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

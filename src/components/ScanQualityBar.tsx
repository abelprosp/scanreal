"use client";

import type { ScanQuality } from "@/lib/types/environment";

export function ScanQualityBar({ quality }: { quality: ScanQuality }) {
  const color =
    quality.score >= 65
      ? "bg-emerald-500"
      : quality.score >= 40
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">Qualidade para IA</span>
        <span
          className={
            quality.readyForAI ? "font-medium text-emerald-400" : "text-amber-400"
          }
        >
          {quality.score}%
          {quality.readyForAI ? " · pronto" : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full transition-all duration-300 ${color}`}
          style={{ width: `${quality.score}%` }}
        />
      </div>
      {quality.issues.length > 0 && (
        <ul className="space-y-0.5 text-xs text-amber-200/90">
          {quality.issues.map((i) => (
            <li key={i}>• {i}</li>
          ))}
        </ul>
      )}
      {quality.tips.length > 0 && !quality.readyForAI && (
        <ul className="space-y-0.5 text-xs text-zinc-500">
          {quality.tips.map((t) => (
            <li key={t}>→ {t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

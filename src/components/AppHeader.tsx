import Link from "next/link";

export function AppHeader() {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600/20 text-lg text-emerald-400">
            ◈
          </span>
          <div>
            <p className="font-semibold text-zinc-50">AmbientScan</p>
            <p className="text-xs text-zinc-500">A-Frame · Three.js · WebXR Depth</p>
          </div>
        </Link>
        <nav className="flex gap-2 text-sm">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-zinc-300 hover:bg-zinc-800"
          >
            Início
          </Link>
          <Link
            href="/scan"
            className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-500"
          >
            Novo mapa
          </Link>
        </nav>
      </div>
    </header>
  );
}

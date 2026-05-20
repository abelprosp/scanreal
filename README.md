# AmbientScan

Sistema web em **Next.js + React** para mapear ambientes (casa, loja, sala) usando **A-Frame**, **Three.js** e **WebXR Depth API**.

## Funcionalidades

- Scanner AR no navegador (câmera do celular)
- Acúmulo de nuvem de pontos 3D via Depth API (CPU/GPU) ou fallback estimado
- Salvamento local (IndexedDB) dos mapas
- Visualizador 3D com navegação (orbitar, zoom, WASD)

## Requisitos

- **HTTPS** em produção (WebXR exige contexto seguro)
- Navegador com suporte a `immersive-ar` (recomendado: **Chrome no Android**)
- Suporte de profundidade **varia por aparelho** — o app detecta e informa

## Desenvolvimento

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000` no PC para gerenciar mapas. Para AR real, use o IP da máquina na rede com HTTPS (ex.: `ngrok`) ou deploy.

## Estrutura

- `src/lib/xr/` — sessão WebXR, amostragem de depth, registro do componente A-Frame
- `src/components/xr/DepthScanner.tsx` — cena AR
- `src/components/xr/PointCloudViewer.tsx` — navegação Three.js
- `src/lib/storage/environments.ts` — persistência IndexedDB

## Limitações conhecidas

- iOS/Safari tem suporte WebXR limitado
- Depth API pode não estar disponível mesmo com AR ativo
- Mapa é nuvem de pontos simplificada, não mesh fotorealista
"# scanreal" 

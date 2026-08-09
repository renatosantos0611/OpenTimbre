# OpenTimbre

Assistente de timbre para guitarra: você descreve o som que quer em um chat, a IA monta o rig e aplica os ajustes nos plugins **Neural DSP** (Gojira, Petrucci, Soldano, Tim Henson) via MIDI. Aplicativo desktop (Electron + Angular), com auto-update e interface em inglês/português.

Instalador para Windows: [Releases](https://github.com/renatosantos0611/OpenTimbre/releases).

## Tutorial de desenvolvimento no Windows

Pré-requisitos:

- **Node.js 22+** e npm
- Para o fluxo completo de áudio/MIDI: **loopMIDI** (porta virtual) e um plugin Neural DSP instalado. Só para ajustar e visualizar a interface, isso não é necessário.

### Executar

```powershell
git clone https://github.com/renatosantos0611/OpenTimbre.git
cd OpenTimbre
npm install
npm run desktop
```

`npm run desktop` recompila o app (main + preload + renderer) e abre a janela do OpenTimbre.

### Ajustar e visualizar alterações

O ciclo de desenvolvimento é: editar → `npm run desktop` de novo (cada execução recompila e reabre o app).

- **Interface (telas, cores, textos)**: edite `packages/desktop/src/app/**` (componentes Angular) e os estilos/tokens em `packages/desktop/src/styles.css`. Textos visíveis ficam no catálogo de mensagens `packages/i18n/src/en.json` / `pt.json` — nunca hardcoded.
- **Lógica do app / IPC**: `packages/desktop/src/main/**`.
- **Domínio (chat, rigs, catálogo de plugins)**: `packages/core/src/**`.

Dicas:

- Mudou só TypeScript de main/preload ou renderer sem mudar contratos? `npm run typecheck` dá o retorno rápido sem reabrir o app.
- Antes de commitar, rode as provas do projeto:

```powershell
npm run check   # typecheck + todos os testes
npm run lint
```

- Testes de interface (renderer) e do fluxo da janela: `npm run test -w @opentimbre/desktop` e `npm run test:e2e -w @opentimbre/desktop`.

## Estrutura

| Pacote | Papel |
| --- | --- |
| `packages/core` | Domínio puro: chat/rigs, catálogo de plugins, i18n-safe — sem Electron |
| `packages/desktop` | App Electron: main, preload, renderer Angular, empacotamento |
| `packages/platform-node` | Integração de plataforma: MIDI, descoberta de plugins |
| `packages/i18n` | Catálogo de mensagens en/pt compartilhado |
| `contracts` | Tipos do contrato IPC/main↔renderer |
| `packages/cli` | CLI |

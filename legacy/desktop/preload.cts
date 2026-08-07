/**
 * Ponte entre o renderer e o main.
 *
 * CommonJS (`.cts`) porque é o que o preload do Electron aceita. Nada de
 * `ipcRenderer` cru vaza para a página — o renderer só enxerga os métodos
 * abaixo, que são exatamente os canais que existem.
 */

import { contextBridge, ipcRenderer } from 'electron'
import type {
  Api,
  Estado,
  EstadoPlugin,
  Guitarra,
  Preferencia,
  ProviderId,
  Resumo,
  StatusChat,
  Tema,
  TemaResolvido,
} from './ipc.js'

/**
 * O tema chega por `additionalArguments` da janela, não por IPC: o renderer
 * precisa dele na primeira linha que executa, e um `invoke` só responderia
 * depois — tempo suficiente para a tela piscar escura antes de virar clara.
 */
const PREFIXO_TEMA = '--tema='
const temaInicial = (process.argv
  .find((a) => a.startsWith(PREFIXO_TEMA))
  ?.slice(PREFIXO_TEMA.length) ?? 'escuro') as TemaResolvido

const api: Api = {
  temaInicial,
  estado: () => ipcRenderer.invoke('app:estado') as Promise<Estado>,
  enviar: (texto: string) => ipcRenderer.invoke('chat:enviar', texto),
  novaConversa: () => ipcRenderer.invoke('chat:nova') as Promise<void>,
  aplicar: (cena: string) => ipcRenderer.invoke('rig:aplicar', cena),
  salvarGuitarra: (g: Guitarra) => ipcRenderer.invoke('config:guitarra', g),
  escolherModelo: (provider: ProviderId, id: string) => ipcRenderer.invoke('ia:modelo', provider, id),
  estadoPlugin: (id: string) => ipcRenderer.invoke('plugin:estado', id),
  abrirPlugin: (id: string) => ipcRenderer.invoke('plugin:abrir', id),
  instalarMapeamento: (id: string) => ipcRenderer.invoke('plugin:mapeamento', id),
  alternarTopo: () => ipcRenderer.invoke('janela:topo') as Promise<boolean>,
  definirEscurecer: (valor: boolean) =>
    ipcRenderer.invoke('janela:escurecer', valor) as Promise<boolean>,
  definirAutoAplicar: (valor: boolean) =>
    ipcRenderer.invoke('janela:autoaplicar', valor) as Promise<boolean>,
  definirTema: (t: Tema) => ipcRenderer.invoke('janela:tema', t) as Promise<Estado>,
  salvarChave: (provedor: ProviderId, chave: string) =>
    ipcRenderer.invoke('chaves:salvar', provedor, chave),
  removerChave: (provedor: ProviderId) => ipcRenderer.invoke('chaves:remover', provedor),
  preferirProvedor: (p: Preferencia) => ipcRenderer.invoke('ia:provedor', p),
  listarConversas: () => ipcRenderer.invoke('conversas:listar') as Promise<Resumo[]>,
  abrirConversa: (id: string) => ipcRenderer.invoke('conversas:abrir', id),
  apagarConversa: (id: string) => ipcRenderer.invoke('conversas:apagar', id) as Promise<Resumo[]>,
  onStatus: (cb: (s: StatusChat) => void) => {
    ipcRenderer.on('chat:status', (_evento, s: StatusChat) => cb(s))
  },
  onTema: (cb: (t: TemaResolvido) => void) => {
    ipcRenderer.on('janela:tema-mudou', (_evento, t: TemaResolvido) => cb(t))
  },
  onPlugin: (cb: (e: EstadoPlugin) => void) => {
    ipcRenderer.on('plugin:mudou', (_evento, e: EstadoPlugin) => cb(e))
  },
}

contextBridge.exposeInMainWorld('api', api)

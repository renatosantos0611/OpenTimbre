/**
 * Contrato entre main, preload e renderer.
 *
 * Só tipos — este arquivo é apagado na compilação. Ele existe para os três
 * lados concordarem sobre o formato dos canais sem que o renderer precise
 * importar nada do núcleo (que roda em Node e não sobreviveria no navegador).
 */

import type { Chave } from '../src/chaves.js'
import type { Mensagem, Resumo } from '../src/conversas.js'
import type { Guitarra } from '../src/guitarra.js'
import type { CartaoParams } from '../src/plugins/exibicao.js'
import type { ProviderId } from '../src/providers/types.js'
import type { Rig } from '../src/schema.js'
import type { Tema, TemaResolvido } from '../src/tema.js'

export type { Chave, Cofre } from '../src/chaves.js'
export type { Mensagem, Resumo } from '../src/conversas.js'
export type { Guitarra } from '../src/guitarra.js'
export type { CartaoParams, PedalExibido, ValorExibido } from '../src/plugins/exibicao.js'
export type { ProviderId } from '../src/providers/types.js'
export type { CenaDetalhada, Rig } from '../src/schema.js'
export type { Tema, TemaResolvido } from '../src/tema.js'

/** `auto` = a ordem padrão do `provider.ts`, sem preferência gravada. */
export type Preferencia = 'auto' | ProviderId

/**
 * Um modelo disponível para escolha — de **qualquer** provedor com chave
 * válida, não só o que está atendendo agora. `providerLabel` viaja pronto
 * porque o renderer não importa `provider.ts` (que puxa os SDKs inteiros).
 */
export type ModeloDisponivel = { provider: ProviderId; providerLabel: string; id: string }

/** Estado mostrado na barra superior, montado no `app:estado`. */
export type Estado = {
  midi: { porta: string | null; erro: string | null }
  ia: { provider: ProviderId; label: string; model: string; disponiveis: ModeloDisponivel[] } | null
  iaErro: string | null
  guitarra: Guitarra
  sempreNoTopo: boolean
  escurecerSemFoco: boolean
  /** Aplica sozinha quando a IA responde com uma sugestão só (rig de uma cena). */
  autoAplicar: boolean
  /**
   * `escolhido` é o que está marcado em Configurações; `resolvido` é o que a
   * tela pinta — só o main sabe traduzir `sistema`, porque quem responde pelo
   * tema do Windows é o `nativeTheme`.
   */
  tema: { escolhido: Tema; resolvido: TemaResolvido }
  /** Uma entrada por provedor do catálogo, sempre — inclusive sem chave salva. */
  chaves: Chave[]
  /** Banco ilegível. A tela avisa e continua; o `.env` ainda atende. */
  chavesErro: string | null
  preferencia: Preferencia
  /**
   * `AI_PROVIDER` no ambiente. Quando presente, ela vence a preferência da
   * janela, e o seletor precisa dizer isso em vez de fingir que manda.
   */
  provedorForcado: string | null
  /** Onde as chaves ficam, para a tela poder mostrar. */
  bancoChaves: string
  /** Para o diálogo "Sobre" — vem do `package.json`, não de constante duplicada. */
  versao: string
}

/**
 * O que cada cena mostra no cartão, já derivado do `PluginSpec`.
 *
 * Vem pronto do main de propósito: o renderer roda no navegador e não consegue
 * importar um `PluginSpec` (todos eles importam `node:path`). Chaveado pelo
 * nome da cena, igual a `Rig.cenas`.
 */
export type Cartoes = Record<string, CartaoParams>

export type Turno = { texto: string; rig: Rig | null; cartoes: Cartoes | null }

/**
 * O app do plugin que a IA escolheu. Alimenta a barra fixa no topo da conversa:
 * um timbre só vira som se o plugin estiver aberto e com o mapeamento certo.
 */
export type EstadoPlugin = {
  id: string
  nome: string
  instalado: boolean
  caminho: string | null
  rodando: boolean
  mapeamento: 'ok' | 'desatualizado' | 'ausente'
}

/** Uma mensagem do histórico com os cartões já derivados, como no `Turno`. */
export type MensagemUI = Mensagem & { cartoes?: Cartoes }

/** Uma conversa do histórico, pronta para a janela redesenhar. */
export type Aberta = {
  id: string
  titulo: string
  mensagens: MensagemUI[]
  /** Plugin da última rig da conversa, ou `null` se ela não chegou a gerar uma. */
  plugin: string | null
  /**
   * `true` quando o histórico salvo não pôde ser reaproveitado — outro provedor
   * de IA, ou um formato de versão anterior. A transcrição volta na tela, mas o
   * modelo não lembra dela.
   */
  memoriaPerdida: boolean
}

export type Aplicado = {
  cena: string
  amp: string
  ccsSent: number
  ms: number
  /** Aviso de amp sem knobs mapeados e instrução da estratégia `manual`. */
  avisos: string[]
}

/**
 * Nenhum handler rejeita: um erro de rede ou de validação vira uma mensagem
 * vermelha no chat, não uma promessa quebrada que derrubaria a janela.
 */
export type Falha = { erro: string }
export type Resultado<T> = T | Falha

export function falhou<T>(r: Resultado<T>): r is Falha {
  return typeof r === 'object' && r !== null && 'erro' in r
}

/** Fases da chamada, para a pílula de status. `null` limpa a pílula. */
export type StatusChat = 'consultando' | 'validando' | 'corrigindo' | null

export type Api = {
  /**
   * O tema resolvido, disponível **antes** da página carregar. É o que impede o
   * piscar escuro na abertura de uma janela clara: `estado()` só volta depois de
   * uma ida à rede, e até lá a tela já teria sido pintada.
   */
  readonly temaInicial: TemaResolvido
  estado(): Promise<Estado>
  enviar(texto: string): Promise<Resultado<Turno>>
  novaConversa(): Promise<void>
  aplicar(cena: string): Promise<Resultado<Aplicado>>
  salvarGuitarra(g: Guitarra): Promise<Resultado<Estado>>
  /**
   * `provider` pode ser diferente do provedor que está atendendo agora — nesse
   * caso a escolha também troca quem atende (ver `ModeloDisponivel`), porque
   * escolher um modelo de outro catálogo só faz sentido virando o agente ativo.
   */
  escolherModelo(provider: ProviderId, id: string): Promise<Resultado<Estado>>
  estadoPlugin(id: string): Promise<Resultado<EstadoPlugin>>
  abrirPlugin(id: string): Promise<Resultado<EstadoPlugin>>
  instalarMapeamento(id: string): Promise<Resultado<EstadoPlugin>>
  alternarTopo(): Promise<boolean>
  definirEscurecer(valor: boolean): Promise<boolean>
  definirAutoAplicar(valor: boolean): Promise<boolean>
  definirTema(t: Tema): Promise<Estado>
  /** A chave em claro sobe uma vez e não volta nunca — a tela só recebe a dica. */
  salvarChave(provedor: ProviderId, chave: string): Promise<Resultado<Estado>>
  removerChave(provedor: ProviderId): Promise<Resultado<Estado>>
  preferirProvedor(p: Preferencia): Promise<Resultado<Estado>>
  listarConversas(): Promise<Resumo[]>
  abrirConversa(id: string): Promise<Resultado<Aberta>>
  apagarConversa(id: string): Promise<Resumo[]>
  onStatus(cb: (s: StatusChat) => void): void
  /** Dispara quando o Windows troca de tema com a opção `sistema` marcada. */
  onTema(cb: (t: TemaResolvido) => void): void
  /**
   * Dispara quando o app do plugin abre, fecha ou tem o mapeamento alterado por
   * fora. É o que faz a barra do topo reagir ao guitarrista fechar o plugin no
   * meio da sessão — sem isso a tela seguiria dizendo "aberto" e os botões de
   * aplicar mandariam CC para ninguém.
   */
  onPlugin(cb: (e: EstadoPlugin) => void): void
}

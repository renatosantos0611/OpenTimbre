/**
 * Processo main da janela flutuante.
 *
 * Ele é o dono de todo o estado — sessão de conversa, rig carregada, porta MIDI
 * — porque é o único processo que pode carregar o addon nativo do
 * `@julusian/midi`. O renderer só desenha e pede coisas por IPC.
 */

import { BrowserWindow, app, ipcMain, nativeTheme, safeStorage } from 'electron'
import path from 'node:path'
import * as chaves from '../src/chaves.js'
import { criarSessao, type Sessao } from '../src/chat.js'
import * as conversas from '../src/conversas.js'
import * as guitarra from '../src/guitarra.js'
import * as escolhas from '../src/ia.js'
import { exibirCena } from '../src/plugins/exibicao.js'
import { exigir, getAmpStrategy, porId, type PluginSpec } from '../src/plugins/index.js'
import * as lancador from '../src/plugins/lancador.js'
import * as janela from '../src/janela.js'
import * as library from '../src/library.js'
import * as midi from '../src/midi-out.js'
import { checkAll, resolveProvider } from '../src/provider.js'
import type { ProviderId } from '../src/providers/types.js'
import { loadSystemPrompt } from '../src/rig-builder.js'
import type { Rig } from '../src/schema.js'
import * as tema from '../src/tema.js'
import * as trace from '../src/trace.js'
import type {
  Aberta,
  Aplicado,
  Cartoes,
  Estado,
  EstadoPlugin,
  Falha,
  MensagemUI,
  ModeloDisponivel,
  Preferencia,
  StatusChat,
  Turno,
} from './ipc.js'

const NOME = 'OpenTimbre'

/**
 * O ícone é copiado para junto do renderer no build (ver `build-desktop.mjs`).
 * Caminho relativo ao bundle, não ao `cwd`: a janela precisa achá-lo mesmo
 * quando o Electron é iniciado de outro diretório.
 */
const ICONE = path.join(__dirname, 'renderer', 'icon', 'opentimbre-icon.png')

/**
 * Antes do `whenReady`, senão não pega. `setName` batiza a app nos diálogos
 * nativos; o AppUserModelID é o que faz o Windows tratar a janela como um
 * programa próprio — sem ele a barra de tarefas agrupa tudo sob "Electron" e
 * mostra o ícone dele, por mais que a janela tenha o seu.
 */
app.setName(NOME)
app.setAppUserModelId('com.opentimbre.app')

/**
 * Versão mostrada no diálogo "Sobre". Sai do `package.json` via
 * `app.getVersion()` — repetir o número numa constante aqui garantiria que os
 * dois divergissem na primeira vez que alguém publicasse uma versão.
 *
 * O `.0` final some porque o npm exige semver de três partes (`0.1` não é
 * versão válida no `package.json`) mas ninguém escreve "versão 0.1.0" numa tela
 * de Sobre. Um patch de verdade (`0.1.2`) continua aparecendo inteiro.
 */
const VERSAO = app.getVersion().replace(/\.0$/, '')

// O REPL ganha o .env pelo `tsx --env-file-if-exists`; aqui quem carrega é a
// própria app, porque o Electron não tem esse atalho.
try {
  process.loadEnvFile(path.resolve(process.cwd(), '.env'))
} catch {
  // Sem .env: as chaves podem vir do ambiente. Quem reclama é o `resolveProvider`.
}

// ------------------------------------------------------------------- estado

let win: BrowserWindow | null = null
let config = janela.load()
let temaEscolhido = tema.load()

/**
 * O tema que a tela pinta. Quem responde é o `nativeTheme` mesmo quando a
 * escolha é explícita: atribuir `themeSource` faz o Electron devolver a escolha
 * em `shouldUseDarkColors`, então existe um caminho só para os três casos, e
 * não um `if (escolhido === 'sistema')` espalhado.
 */
function temaResolvido(): tema.TemaResolvido {
  return nativeTheme.shouldUseDarkColors ? 'escuro' : 'claro'
}

const FONTE: Record<tema.Tema, typeof nativeTheme.themeSource> = {
  sistema: 'system',
  claro: 'light',
  escuro: 'dark',
}

let systemPrompt = loadSystemPrompt()
let sessao: Sessao | null = null
let rig: Rig | null = null

/**
 * A conversa em andamento. Nasce só quando a primeira mensagem é enviada — uma
 * janela aberta e nunca usada não deve deixar arquivo vazio no histórico.
 */
let conversa: conversas.Conversa | null = null

function registrar(papel: conversas.Papel, texto: string, rigDoTurno?: Rig): void {
  if (!conversa || !sessao) return

  conversa.mensagens.push(rigDoTurno ? { papel, texto, rig: rigDoTurno } : { papel, texto })
  conversa.atualizadaEm = new Date().toISOString()
  conversa.provedor = sessao.provedor
  conversa.historico = sessao.exportar()

  try {
    conversas.salvar(conversa)
  } catch {
    // Histórico é conveniência: se o disco recusar, a conversa segue na tela.
  }
}

let portaMidi: string | null = null
let erroMidi: string | null = null

function abrirMidi(): void {
  try {
    portaMidi = midi.openPort()
    erroMidi = null
  } catch (err) {
    // Porta ausente não pode impedir a janela de abrir: o guitarrista ainda
    // consegue conversar e gerar timbres, só não aplicar.
    portaMidi = null
    erroMidi = err instanceof Error ? err.message : String(err)
  }
}

/** Nenhum handler rejeita — erro vira mensagem na tela. */
function falha(err: unknown): Falha {
  return { erro: err instanceof Error ? err.message : String(err) }
}

/**
 * O que cada cena da rig mostra no cartão, derivado aqui porque o renderer não
 * consegue importar um `PluginSpec`. Uma rig de um plugin que saiu do catálogo
 * devolve `null` — o cartão cai para o texto, que continua legível.
 */
function cartoesDa(r: Rig): Cartoes | null {
  const spec = porId(r.plugin)
  if (!spec) return null

  const out: Cartoes = {}
  for (const [nome, cena] of Object.entries(r.cenas)) {
    out[nome] = exibirCena(spec, cena.params, r.amp)
  }
  return out
}

// ------------------------------------------------------------------- janela

function criarJanela(): void {
  const cromo = tema.CROMO[temaResolvido()]

  win = new BrowserWindow({
    width: config.largura,
    height: config.altura,
    x: config.x,
    y: config.y,
    minWidth: janela.LARGURA_MIN,
    minHeight: janela.ALTURA_MIN,
    alwaysOnTop: config.sempreNoTopo,
    // Pintado antes da primeira renderização: é este fundo que aparece no
    // instante entre a janela existir e o CSS ser aplicado.
    backgroundColor: cromo.fundo,
    title: NOME,
    icon: ICONE,
    show: false,
    // Barra de título própria, com os botões nativos do Windows pintados para
    // não deixar uma faixa de cor errada em cima da janela.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: cromo.fundo, symbolColor: cromo.simbolo, height: 40 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // O renderer precisa do tema na primeira linha que executa; um `invoke`
      // só responderia depois da tela já pintada. Ver `preload.cts`.
      additionalArguments: [`--tema=${temaResolvido()}`],
    },
  })

  // 'floating' mantém a janela acima de janelas normais sem virar um overlay
  // de sistema — é o nível certo para conviver com o plugin.
  if (config.sempreNoTopo) win.setAlwaysOnTop(true, 'floating')

  win.on('blur', () => {
    if (config.escurecerSemFoco) win?.setOpacity(janela.OPACIDADE_SEM_FOCO)
  })
  win.on('focus', () => win?.setOpacity(1))

  win.on('close', salvarGeometria)
  win.on('closed', () => {
    win = null
    // Sem janela não há barra para atualizar — e o timer sozinho seguraria o
    // processo vivo depois do `window-all-closed`.
    pararVigia()
  })

  // Sem isto, um erro no renderer (CSP, typo, exceção no boot) só aparece se
  // alguém abrir o DevTools — a janela fica em branco e o terminal, mudo.
  win.webContents.on('console-message', (_e, nivel, mensagem, linha, origem) => {
    if (nivel >= 2) console.error(`[renderer] ${mensagem}  (${origem}:${linha})`)
  })
  win.webContents.on('did-fail-load', (_e, codigo, descricao) => {
    console.error(`[renderer] falhou ao carregar: ${descricao} (${codigo})`)
  })

  win.once('ready-to-show', () => win?.show())
  void win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

function salvarGeometria(): void {
  if (!win) return
  const { width, height, x, y } = win.getBounds()
  config = { ...config, largura: width, altura: height, x, y }
  try {
    janela.save(config)
  } catch {
    // Geometria é conveniência: se o disco recusar, a janela ainda fecha.
  }
}

// -------------------------------------------------------------------- status

/**
 * Traduz as fases do `trace` na pílula de status. O trace é ferramenta de
 * desenvolvedor e vive desligado, mas os assinantes são avisados de qualquer
 * jeito — é isso que faz a pílula funcionar com `AI_TRACE=off`.
 */
function status(s: StatusChat): void {
  win?.webContents.send('chat:status', s)
}

trace.subscribe((e) => {
  if (e.operation !== 'chat') return
  if (e.kind === 'request') status('consultando')
  else if (e.kind === 'response') status('validando')
  else if (e.kind === 'retry') status('corrigindo')
})

// ---------------------------------------------------------------------- IPC

/**
 * Modelos de **todo** provedor cuja chave vale agora, não só o que está
 * atendendo — é o que deixa o seletor misturar os catálogos quando as duas
 * chaves (Anthropic e OpenAI) estão configuradas. Cache com a mesma regra de
 * `resolveProvider`: só refaz a rodada de `validate()` quando `revalidar`
 * manda, senão toda repintura de estado pagaria duas idas à rede à toa.
 */
let disponiveisCache: ModeloDisponivel[] | null = null

async function disponiveis(revalidar: boolean): Promise<ModeloDisponivel[]> {
  if (disponiveisCache && !revalidar) return disponiveisCache

  const checks = await checkAll()
  const lista: ModeloDisponivel[] = []
  for (const { provider, validation } of checks) {
    if (!validation.ok) continue
    const modelos = await provider.listarModelos().catch(() => [provider.model()])
    for (const id of modelos) lista.push({ provider: provider.id, providerLabel: provider.label, id })
  }
  disponiveisCache = lista
  return lista
}

/**
 * `revalidar` refaz a eleição de provedor em vez de usar o cache. Só quem
 * mexeu numa chave ou na preferência precisa disso — a barra de status, que
 * pergunta o estado a cada abertura de janela, não deve pagar uma ida à rede
 * por chamada.
 */
async function montarEstado(revalidar = false): Promise<Estado> {
  let ia: Estado['ia'] = null
  let iaErro: string | null = null
  try {
    const { chosen } = await resolveProvider(revalidar)
    const lista = await disponiveis(revalidar)
    ia = { provider: chosen.id, label: chosen.label, model: chosen.model(), disponiveis: lista }
  } catch (err) {
    iaErro = err instanceof Error ? err.message : String(err)
  }

  const forcado = process.env.AI_PROVIDER?.trim() || null

  return {
    midi: { porta: portaMidi, erro: erroMidi },
    ia,
    iaErro,
    guitarra: guitarra.load(),
    sempreNoTopo: config.sempreNoTopo,
    escurecerSemFoco: config.escurecerSemFoco,
    autoAplicar: config.autoAplicar,
    tema: { escolhido: temaEscolhido, resolvido: temaResolvido() },
    ...estadoDasChaves(),
    preferencia: (escolhas.provedorPreferido() as Preferencia | undefined) ?? 'auto',
    provedorForcado: forcado,
    versao: VERSAO,
  }
}

/**
 * As chaves nunca podem derrubar a tela: banco corrompido, disco cheio ou um
 * `chaves.db` de outra máquina viram uma linha de erro em Configurações, e o
 * resto da app segue com o que vier do `.env`.
 */
function estadoDasChaves(): Pick<Estado, 'chaves' | 'chavesErro' | 'bancoChaves'> {
  try {
    return { chaves: chaves.listar(), chavesErro: null, bancoChaves: chaves.caminho() }
  } catch (err) {
    return {
      chaves: [],
      chavesErro: err instanceof Error ? err.message : String(err),
      bancoChaves: chaves.caminho(),
    }
  }
}

/**
 * Recria a sessão depois de uma mudança que altera o system prompt ou quem
 * atende, mantendo o histórico. Trocar de provedor no meio da conversa é o caso
 * em que ele não serve — `criarSessao` percebe e começa limpa, em vez de mandar
 * mensagens no formato errado para a API nova.
 */
async function recriarSessao(): Promise<void> {
  if (!sessao || !conversa) return
  try {
    sessao = await criarSessao(systemPrompt, {
      provedor: conversa.provedor,
      historico: conversa.historico,
    })
  } catch {
    // Sem chave válida agora. Zerar deixa a próxima mensagem tentar de novo e
    // reportar o erro no lugar certo — no chat, não num toast de configuração.
    sessao = null
  }
}

ipcMain.handle('app:estado', () => montarEstado())

ipcMain.handle('chat:enviar', async (_e, texto: string): Promise<Turno | Falha> => {
  try {
    // A sessão nasce na primeira mensagem: é aqui que a chave de IA é validada,
    // e fazer isso na abertura atrasaria a janela por uma ida à rede.
    if (!sessao) {
      sessao = await criarSessao(systemPrompt)
      const agora = new Date().toISOString()
      conversa ??= {
        id: conversas.novoId(),
        titulo: conversas.tituloDe(texto),
        criadaEm: agora,
        atualizadaEm: agora,
        provedor: sessao.provedor,
        mensagens: [],
        historico: null,
      }
    }

    registrar('usuario', texto)

    const turno = await sessao.enviar(texto)

    if (turno.rig) {
      rig = turno.rig
      // O nome da música é o que o guitarrista reconhece na lista do histórico,
      // muito mais do que a frase que ele digitou no primeiro turno.
      if (conversa) conversa.titulo = `${turno.rig.artista} — ${turno.rig.musica}`
      // Slug pela música, não pela frase digitada — assim os ajustes seguintes
      // sobrescrevem o mesmo arquivo em vez de espalhar variações.
      try {
        library.save(library.slugify(`${turno.rig.artista} ${turno.rig.musica}`), turno.rig)
      } catch {
        // Cache é conveniência; a rig já está na tela.
      }
    }

    registrar('ia', turno.texto, turno.rig ?? undefined)
    return { ...turno, cartoes: turno.rig ? cartoesDa(turno.rig) : null }
  } catch (err) {
    const f = falha(err)
    registrar('erro', f.erro)
    return f
  } finally {
    status(null)
  }
})

/** Fecha a conversa atual sem apagá-la: ela continua no histórico. */
ipcMain.handle('chat:nova', () => {
  sessao = null
  conversa = null
  rig = null
  // A conversa nova ainda não escolheu plugin, então a barra some da tela e não
  // há mais nada para vigiar até a IA chamar a tool de algum.
  vigiado = null
  pararVigia()
})

ipcMain.handle('conversas:listar', () => conversas.listar())

ipcMain.handle('conversas:abrir', async (_e, id: string): Promise<Aberta | Falha> => {
  try {
    const salva = conversas.carregar(id)
    if (!salva) throw new Error('Conversa não encontrada ou ilegível.')

    sessao = await criarSessao(systemPrompt, {
      provedor: salva.provedor,
      historico: salva.historico,
    })
    conversa = salva
    rig = conversas.ultimaRig(salva)

    // Os cartões são derivados aqui, uma vez por mensagem, porque o renderer
    // redesenha a conversa inteira do histórico exatamente como redesenha um
    // turno novo — e não teria como derivá-los sozinho.
    const mensagens: MensagemUI[] = salva.mensagens.map((m) =>
      m.rig ? { ...m, cartoes: cartoesDa(m.rig) ?? undefined } : m,
    )

    return {
      id: salva.id,
      titulo: salva.titulo,
      mensagens,
      // A barra do topo volta com o plugin daquela conversa, não com o padrão.
      plugin: conversas.pluginDaConversa(salva),
      // O histórico nativo pode não servir — outro provedor, ou um formato de
      // uma versão anterior. A transcrição volta na tela de qualquer jeito, mas
      // aí o modelo não lembra dela, e o guitarrista precisa saber disso.
      memoriaPerdida: !sessao.retomou && salva.mensagens.length > 0,
    }
  } catch (err) {
    return falha(err)
  }
})

ipcMain.handle('conversas:apagar', (_e, id: string) => {
  conversas.apagar(id)
  // Apagar a que está aberta zera a tela; apagar outra não mexe em nada.
  if (conversa?.id === id) {
    sessao = null
    conversa = null
    rig = null
  }
  return conversas.listar()
})

ipcMain.handle('rig:aplicar', (_e, nome: string): Aplicado | Falha => {
  try {
    if (!rig) throw new Error('Nenhum timbre carregado ainda.')
    const cena = rig.cenas[nome]
    if (!cena) throw new Error(`Cena '${nome}' não existe neste timbre.`)
    if (!portaMidi) {
      throw new Error(erroMidi ?? 'Porta MIDI fechada. Abra o loopMIDI e reinicie a janela.')
    }

    // A estratégia de troca de amp é do plugin — cada um tem o seu seletor.
    const spec = exigir(rig.plugin)
    const inicio = performance.now()
    const r = midi.applyScene(spec, cena.params, rig.amp, getAmpStrategy(spec))
    const ms = performance.now() - inicio

    return {
      cena: nome,
      amp: r.amp,
      ccsSent: r.ccsSent,
      ms,
      avisos: [r.warning, r.ampInstruction].filter((a): a is string => Boolean(a)),
    }
  } catch (err) {
    return falha(err)
  }
})

ipcMain.handle('config:guitarra', async (_e, g: unknown): Promise<Estado | Falha> => {
  try {
    guitarra.save(guitarra.GuitarraSchema.parse(g))
    systemPrompt = loadSystemPrompt()

    // A guitarra vive no system prompt, que é montado do zero a cada sessão.
    // Então a conversa em andamento é **recriada** com o prompt novo e o mesmo
    // histórico: o modelo passa a considerar o instrumento novo sem que o
    // guitarrista perca o timbre em que estava trabalhando.
    await recriarSessao()

    return await montarEstado()
  } catch (err) {
    return falha(err)
  }
})

ipcMain.handle(
  'ia:modelo',
  async (_e, provider: ProviderId, id: string): Promise<Estado | Falha> => {
    try {
      const { chosen } = await resolveProvider()
      escolhas.escolherModelo(provider, id)

      // Modelo de outro catálogo: só faz sentido escolhendo-o como o agente
      // ativo. `resolveProvider(true)` refaz a eleição para a preferência
      // nova valer já na sessão que `recriarSessao` está prestes a montar.
      if (provider !== chosen.id) {
        escolhas.preferirProvedor(provider)
        await resolveProvider(true)
      }

      // A conversa continua: o provedor descarta os blocos de raciocínio do
      // modelo antigo (que só ele consegue reler) e mantém o resto do histórico,
      // então o modelo novo entra sabendo do que se estava falando.
      await recriarSessao()

      return await montarEstado()
    } catch (err) {
      return falha(err)
    }
  },
)

// ------------------------------------------------------------ chaves de IA

/**
 * Entrega ao `chaves.ts` a única coisa que ele não pode ter sozinho: a cifragem.
 * No Windows o `safeStorage` usa a DPAPI, que amarra o segredo à conta logada —
 * copiar o `chaves.db` para outra máquina não entrega chave nenhuma.
 *
 * Quando o SO não oferece cifragem, a chave ainda é aceita, só que gravada em
 * texto e **marcada** como desprotegida: a tela avisa, em vez de a app decidir
 * sozinha entre mentir sobre a segurança e recusar o serviço.
 */
function abrirCofre(): void {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      chaves.configurar({
        cofre: {
          proteger: (texto) => safeStorage.encryptString(texto),
          revelar: (dado) => safeStorage.decryptString(Buffer.from(dado)),
        },
      })
    }
    chaves.aplicarNoAmbiente()
  } catch (err) {
    // Banco ilegível não pode impedir a janela de abrir: as chaves do `.env`
    // continuam valendo e Configurações mostra o erro.
    console.error('[chaves] não foi possível carregar as chaves salvas:', err)
  }
}

/**
 * O que toda mudança em chave ou preferência faz depois de gravar: refazer a
 * eleição (o cache guardaria o provedor eleito com a chave antiga) e realinhar
 * a conversa em andamento com quem passou a atender.
 */
async function apósMexerNaIa(): Promise<Estado> {
  await resolveProvider(true).catch(() => null)
  await recriarSessao()
  return montarEstado(true)
}

ipcMain.handle(
  'chaves:salvar',
  async (_e, provedor: ProviderId, chave: string): Promise<Estado | Falha> => {
    try {
      chaves.guardar(provedor, chave)
      return await apósMexerNaIa()
    } catch (err) {
      return falha(err)
    }
  },
)

ipcMain.handle('chaves:remover', async (_e, provedor: ProviderId): Promise<Estado | Falha> => {
  try {
    chaves.remover(provedor)
    return await apósMexerNaIa()
  } catch (err) {
    return falha(err)
  }
})

ipcMain.handle('ia:provedor', async (_e, p: Preferencia): Promise<Estado | Falha> => {
  try {
    escolhas.preferirProvedor(p === 'auto' ? null : p)
    return await apósMexerNaIa()
  } catch (err) {
    return falha(err)
  }
})

// -------------------------------------------------------------- o plugin

/**
 * Estado do app do plugin que a IA escolheu: se está instalado, se já está
 * aberto e se o mapeamento MIDI confere. É o que alimenta a barra fixa no topo
 * da conversa — sem plugin aberto, o timbre é gerado e não vira som.
 */
async function estadoDoPlugin(spec: PluginSpec): Promise<EstadoPlugin> {
  const e = await lancador.estado(spec)
  return { id: spec.id, nome: spec.nome, ...e }
}

/**
 * Vigia do plugin da conversa.
 *
 * O guitarrista fecha o plugin no meio da sessão, e nada avisava a janela: ela
 * continuava dizendo "aberto — pronto para receber os timbres", com os botões
 * de aplicar habilitados, mandando CC para ninguém. Como MIDI é via única, a
 * app não tem como descobrir isso pelo envio — só perguntando ao sistema.
 *
 * Só um plugin é vigiado por vez (o da conversa aberta), e o ciclo só existe
 * enquanto há um. `tasklist` filtrado custa dezenas de milissegundos, então 3s
 * é rápido o bastante para o guitarrista não notar atraso e raro o bastante
 * para não pesar.
 */
const INTERVALO_VIGIA_MS = 3000

let vigiado: PluginSpec | null = null
let ultimoEstado = ''
let timerVigia: NodeJS.Timeout | null = null

function pararVigia(): void {
  if (timerVigia) clearInterval(timerVigia)
  timerVigia = null
}

async function conferirVigiado(): Promise<void> {
  if (!vigiado || !win) return

  const atual = await estadoDoPlugin(vigiado)

  // Só empurra quando algo muda de verdade: uma mensagem a cada 3 segundos
  // faria a barra se repintar para sempre sem motivo.
  const assinatura = `${atual.instalado}|${atual.rodando}|${atual.mapeamento}`
  if (assinatura === ultimoEstado) return

  ultimoEstado = assinatura
  win.webContents.send('plugin:mudou', atual)
}

/**
 * Passa a vigiar `spec`, e devolve o estado dele agora. Trocar de plugin zera a
 * assinatura: sem isso, um plugin fechado seguido de outro fechado não geraria
 * evento, e a barra ficaria mostrando o nome do anterior.
 */
async function vigiar(spec: PluginSpec): Promise<EstadoPlugin> {
  if (vigiado?.id !== spec.id) {
    vigiado = spec
    ultimoEstado = ''
  }

  const atual = await estadoDoPlugin(spec)
  ultimoEstado = `${atual.instalado}|${atual.rodando}|${atual.mapeamento}`

  if (!timerVigia) timerVigia = setInterval(() => void conferirVigiado(), INTERVALO_VIGIA_MS)
  return atual
}

ipcMain.handle('plugin:estado', async (_e, id: string): Promise<EstadoPlugin | Falha> => {
  try {
    return await vigiar(exigir(id))
  } catch (err) {
    return falha(err)
  }
})

ipcMain.handle('plugin:abrir', async (_e, id: string): Promise<EstadoPlugin | Falha> => {
  try {
    const spec = exigir(id)
    // Já aberto: só devolve o estado. Uma segunda instância brigaria pelo
    // dispositivo de áudio com a primeira.
    if (!(await lancador.rodando(spec))) lancador.abrir(spec)
    // O processo leva alguns segundos para aparecer no `tasklist`; quem avisa
    // que ele subiu é o vigia, não uma bateria de reconsultas na tela.
    return await vigiar(spec)
  } catch (err) {
    return falha(err)
  }
})

ipcMain.handle('plugin:mapeamento', async (_e, id: string): Promise<EstadoPlugin | Falha> => {
  try {
    const spec = exigir(id)
    lancador.instalarMapeamento(spec)
    return await vigiar(spec)
  } catch (err) {
    return falha(err)
  }
})

ipcMain.handle('janela:topo', () => {
  config = { ...config, sempreNoTopo: !config.sempreNoTopo }
  win?.setAlwaysOnTop(config.sempreNoTopo, 'floating')
  janela.save(config)
  return config.sempreNoTopo
})

ipcMain.handle('janela:escurecer', (_e, valor: boolean) => {
  config = { ...config, escurecerSemFoco: Boolean(valor) }
  janela.save(config)
  // Sem o ajuste imediato, desligar a opção deixaria a janela presa translúcida
  // até o próximo ciclo de foco.
  if (!config.escurecerSemFoco) win?.setOpacity(1)
  return config.escurecerSemFoco
})

ipcMain.handle('janela:autoaplicar', (_e, valor: boolean) => {
  config = { ...config, autoAplicar: Boolean(valor) }
  janela.save(config)
  return config.autoAplicar
})

// ------------------------------------------------------------------- tema

/**
 * Repinta o que o CSS não alcança: o fundo que o Windows usa ao redimensionar e
 * os botões nativos da barra de título. Sem isto, escolher o tema claro deixaria
 * uma faixa preta com um X cinza em cima de uma janela branca.
 */
function aplicarCromo(): void {
  const resolvido = temaResolvido()
  const cromo = tema.CROMO[resolvido]

  win?.setBackgroundColor(cromo.fundo)
  win?.setTitleBarOverlay({ color: cromo.fundo, symbolColor: cromo.simbolo, height: 40 })
  win?.webContents.send('janela:tema-mudou', resolvido)
}

// Com `sistema` marcado, quem troca o tema é o Windows — e a janela precisa
// acompanhar sem ser reaberta. Com uma escolha explícita o evento também
// dispara, e `temaResolvido` já devolve a escolha, então não há o que filtrar.
nativeTheme.on('updated', aplicarCromo)

ipcMain.handle('janela:tema', async (_e, t: unknown): Promise<Estado> => {
  temaEscolhido = tema.TemaSchema.parse(t)
  nativeTheme.themeSource = FONTE[temaEscolhido]

  try {
    tema.save(temaEscolhido)
  } catch {
    // Preferência é conveniência: se o disco recusar, o tema vale nesta sessão.
  }

  // `nativeTheme.on('updated')` cobre a troca vinda do SO, mas não dispara
  // quando `themeSource` recebe o valor que já estava lá — repintar aqui é o
  // que mantém as duas rotas equivalentes.
  aplicarCromo()
  return montarEstado()
})

// ---------------------------------------------------------------- ciclo de vida

// Duas instâncias abririam a mesma porta `VoiceRig` e brigariam por ela — a
// segunda apenas traz a primeira para a frente.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  void app.whenReady().then(() => {
    // Antes de qualquer coisa que fale com a IA: o `resolveProvider` lê a chave
    // do `process.env`, e é aqui que a chave salva na janela entra lá.
    abrirCofre()
    // A escolha gravada precisa valer já na criação da janela, senão o fundo e
    // a barra de título nascem com o tema do sistema e trocam de cor na cara do
    // usuário um instante depois.
    nativeTheme.themeSource = FONTE[temaEscolhido]

    abrirMidi()
    criarJanela()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) criarJanela()
    })
  })
}

app.on('window-all-closed', () => app.quit())

// Sem isto a porta virtual pode ficar presa no Windows.
app.on('before-quit', () => midi.close())

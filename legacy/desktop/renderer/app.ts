/**
 * Renderer da janela flutuante.
 *
 * Sem framework: a tela é pequena e a árvore é rasa. Todo texto entra por
 * `textContent`, nunca por `innerHTML` — o conteúdo vem de um modelo de
 * linguagem, e a CSP da página não permitiria script inline de qualquer forma.
 *
 * O princípio que governa o cartão: **parâmetro é dado, não prosa**. Os valores
 * ficam numa linha própria, em caixa alta condensada, e nunca dentro de um
 * parágrafo. Quem decide *quais* valores são esses é `src/plugins/exibicao.ts`,
 * no main — aqui só se desenha o que veio pronto.
 */

import type {
  Aberta,
  Api,
  CartaoParams,
  Cartoes,
  CenaDetalhada,
  Chave,
  Estado,
  EstadoPlugin,
  ModeloDisponivel,
  Preferencia,
  Resultado,
  Resumo,
  Rig,
  StatusChat,
  Tema,
  TemaResolvido,
  Turno,
} from '../ipc.js'

declare global {
  interface Window {
    api: Api
  }
}

const api = window.api

/**
 * O tema, antes de qualquer outra coisa: este script roda no fim do `<body>` e
 * `temaInicial` já veio pronto do main pelo preload, então o atributo é escrito
 * antes da primeira pintura. Fazer isso depois de `api.estado()` — que espera
 * uma ida à rede — deixaria a janela clara piscar escura ao abrir.
 */
function pintarTema(t: TemaResolvido): void {
  document.documentElement.dataset.tema = t
}

pintarTema(api.temaInicial)
api.onTema(pintarTema)

const CAPTADORES = ['single', 'humbucker', 'HSS', 'HSH', 'P90', 'outro']

/** Atalhos do estado vazio: mostram o tipo de pedido que a app entende. */
const SUGESTOES = ['One — Metallica', 'Clean jazz quente', 'Fuzz stoner', 'Blues crunch']

/** Quanto tempo o botão fica verde antes de voltar a "Aplicar de novo". */
const MS_CONFIRMACAO = 1600

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const mensagens = $<HTMLDivElement>('mensagens')
const stream = $<HTMLDivElement>('stream')
const convite = $<HTMLDivElement>('convite')
const entrada = $<HTMLTextAreaElement>('entrada')
const btnEnviar = $<HTMLButtonElement>('btn-enviar')
const lista = $<HTMLDivElement>('lista-conversas')

let ocupado = false
let pilula: HTMLDivElement | null = null
/** Id da conversa aberta, para destacá-la na lista do histórico. */
let conversaAtual: string | null = null
/** Plugin que a IA escolheu nesta conversa — o da barra fixa. */
let pluginAtual: string | null = null
/** Nome curto do plugin, usado no rótulo de cada botão de aplicar. */
let destino = 'plugin'
/** Sem o app do plugin aberto, aplicar não vira som — os botões ficam cinza. */
let pluginAberto = false
/** Espelha `Estado.autoAplicar` — persistido pelo main, lido de `pintarEstado`. */
let autoAplicarLigado = false

// ------------------------------------------------------------------ helpers

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  texto?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (texto !== undefined) node.textContent = texto
  return node
}

/** Ícone do sprite. `use` só funciona via namespace SVG. */
function icone(id: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'ic')
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use')
  use.setAttribute('href', `#${id}`)
  svg.append(use)
  return svg
}

function aoFim(): void {
  stream.scrollTop = stream.scrollHeight
}

/** O convite some no primeiro conteúdo e volta quando a conversa é zerada. */
function mostrarConvite(mostrar: boolean): void {
  convite.hidden = !mostrar
}

/**
 * `Archetype Petrucci X` → `Petrucci`. O botão de aplicar precisa nomear para
 * onde o clique vai, mas o nome completo não cabe numa janela de 420px — e o
 * prefixo da linha e o sufixo de geração não distinguem um plugin do outro.
 */
function nomeCurto(nome: string): string {
  return nome.replace(/^Archetype:?\s+/i, '').replace(/\s+X$/, '')
}

function hora(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** Data curta o bastante para caber numa janela de 420px. */
function quando(iso: string): string {
  const data = new Date(iso)
  const minutos = Math.floor((Date.now() - data.getTime()) / 60000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`

  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const hoje = new Date()
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (mesmoDia(data, hoje)) return hora

  const ontem = new Date(hoje)
  ontem.setDate(hoje.getDate() - 1)
  if (mesmoDia(data, ontem)) return `ontem ${hora}`

  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ------------------------------------------------------------------ mensagens

function addUsuario(texto: string): void {
  mostrarConvite(false)
  const bloco = el('div', 'de-usuario')
  bloco.append(el('div', 'bolha', texto))
  mensagens.append(bloco)
  aoFim()
}

function addErro(texto: string): void {
  mostrarConvite(false)
  const bloco = el('div', 'da-ia')
  bloco.append(el('p', 'erro', texto))
  mensagens.append(bloco)
  aoFim()
}

// -------------------------------------------------------- cartão de cena

/**
 * O botão nunca se esgota: o guitarrista alterna entre base e solo dezenas de
 * vezes na mesma sessão, então "Enviado" travado seria um bug com cara de
 * recurso. Ele só troca de rótulo, e quem responde "eu já carreguei este?" é o
 * carimbo de horário embaixo, não o estado do botão.
 */
function rotularAplicar(botao: HTMLButtonElement, texto: string, id: string): void {
  botao.replaceChildren(icone(id), el('span', undefined, texto))
}

/**
 * Duas razões diferentes desabilitam um botão de aplicar, e elas não podem se
 * atropelar: o cartão pode ter envelhecido (o main só guarda a rig mais
 * recente) ou o app do plugin pode estar fechado. A primeira é permanente, a
 * segunda muda a cada vez que a barra do topo é reconsultada.
 *
 * O rótulo também é refeito aqui, e não só na montagem do cartão. O motivo é de
 * ordem: quem descobre para onde o clique vai é a barra do plugin, que só é
 * pintada **depois** dos cartões — sem esta passada os botões do primeiro
 * timbre de uma conversa ficariam dizendo "Aplicar no plugin".
 */
function sincronizarAplicar(): void {
  for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('.aplicar'))) {
    // Durante a confirmação verde o botão diz "Aplicado" — mexer nele aqui
    // engoliria o feedback do clique que acabou de acontecer.
    if (!b.classList.contains('feito')) {
      const texto = b.dataset.aplicado === '1' ? 'Aplicar de novo' : `Aplicar no ${destino}`
      rotularAplicar(b, texto, 'i-aplicar')
    }

    if (b.dataset.velho === '1') {
      b.disabled = true
      b.title = 'Timbre substituído por um mais recente nesta conversa'
      continue
    }
    b.disabled = !pluginAberto
    b.title = pluginAberto ? '' : `O ${destino} não está aberto — abra para aplicar`
  }
}

function envelhecerCartoes(): void {
  for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('.aplicar'))) {
    b.dataset.velho = '1'
  }
  sincronizarAplicar()
}

/** A linha de faceplate: só o que o botão carrega no plugin. */
function montarFaceplate(params: CartaoParams): HTMLElement {
  const linha = el('div', 'faceplate')
  for (const v of params.valores) {
    const item = el('span', 'fv')
    item.append(el('b', undefined, v.label), el('i', undefined, v.valor))
    linha.append(item)
  }
  return linha
}

function montarCorpo(cena: CenaDetalhada, params: CartaoParams): HTMLElement {
  const corpo = el('div', 'cartao-corpo')
  corpo.hidden = true

  if (params.pedais.length > 0) {
    const caixa = el('div', 'pedais')
    for (const p of params.pedais) {
      const bloco = el('span', 'pedal')
      // Sem modificador: dentro de `.pedal` o LED é sempre âmbar, que é o outro
      // uso reservado da cor. Verde aqui competiria com o LED da barra do topo.
      bloco.append(el('span', 'led'), el('b', undefined, p.nome))
      if (p.detalhe) bloco.append(el('i', undefined, p.detalhe))
      caixa.append(bloco)
    }
    corpo.append(caixa)
  }

  corpo.append(el('p', 'porque', cena.explicacao))
  return corpo
}

/** O rodapé é o que o guitarrista lê enquanto toca, então nunca fica escondido. */
function montarPe(cena: CenaDetalhada): HTMLElement {
  const pe = el('footer', 'cartao-pe')

  const captador = el('span', 'pe-item')
  captador.append(
    icone('i-captador'),
    el(
      'span',
      undefined,
      `Captador ${cena.guitarra.captador} · vol ${cena.guitarra.volume} · tone ${cena.guitarra.tone}`,
    ),
  )

  const tecnica = el('span', 'pe-item')
  tecnica.append(icone('i-tecnica'), el('span', undefined, cena.guitarra.tecnica))

  pe.append(captador, tecnica)
  return pe
}

/**
 * Três faixas separadas por hairline, e a régua do meio marca uma fronteira
 * real: acima é o que o botão carrega no plugin, abaixo é o que a mão faz.
 * Nasce colapsado, para que duas cenas caibam na mesma tela e a comparação
 * entre base e solo seja imediata.
 */
function montarCartao(nome: string, cena: CenaDetalhada, params: CartaoParams): HTMLElement {
  const cartao = el('article', 'cartao')

  const topo = el('header', 'cartao-topo')
  const id = el('div', 'cartao-id')
  id.append(el('h3', 'cartao-titulo', cena.titulo))
  if (cena.resumo) id.append(el('p', 'cartao-resumo', cena.resumo))

  const aplicarBtn = el('button', 'aplicar')
  aplicarBtn.type = 'button'
  rotularAplicar(aplicarBtn, `Aplicar no ${destino}`, 'i-aplicar')

  const corpo = montarCorpo(cena, params)

  const expandir = el('button', 'expandir')
  expandir.type = 'button'
  expandir.setAttribute('aria-expanded', 'false')
  expandir.setAttribute('aria-label', 'Ver como este timbre foi montado')
  expandir.append(icone('i-chevron'))
  expandir.addEventListener('click', () => {
    corpo.hidden = !corpo.hidden
    expandir.setAttribute('aria-expanded', String(!corpo.hidden))
    cartao.classList.toggle('aberto', !corpo.hidden)
  })

  topo.append(id, aplicarBtn, expandir)

  const carimbo = el('p', 'carimbo')
  carimbo.hidden = true

  aplicarBtn.addEventListener('click', () => void aplicar(nome, cartao, aplicarBtn, carimbo))

  cartao.append(topo, montarFaceplate(params), carimbo, corpo, montarPe(cena))
  return cartao
}

function montarCartoes(rig: Rig, cartoes: Cartoes | null): HTMLElement {
  const caixa = el('div', 'cartoes')

  // Cabeçalho do grupo: de que se trata, quantas cenas vieram e a abordagem.
  const cabeca = el('div', 'grupo-cena')
  cabeca.append(
    el('span', 'tag', rig.musica),
    el(
      'span',
      'grupo-meta',
      `${Object.keys(rig.cenas).length} timbre${Object.keys(rig.cenas).length === 1 ? '' : 's'} · ${rig.nota}`,
    ),
  )
  caixa.append(cabeca)

  const vazio: CartaoParams = { valores: [], pedais: [] }
  for (const [nome, cena] of Object.entries(rig.cenas)) {
    caixa.append(montarCartao(nome, cena, cartoes?.[nome] ?? vazio))
  }
  return caixa
}

/**
 * Devolve o bloco montado — quem chama do envio (`enviar`, abaixo) precisa dele
 * para achar o botão de aplicar quando o modo automático estiver ligado.
 * `pintarConversa`, que redesenha o histórico, ignora o retorno: reaplicar uma
 * cena sozinha ao reabrir uma conversa antiga mandaria MIDI sem o guitarrista
 * ter pedido nada agora.
 */
function addTurno(turno: Turno): HTMLElement {
  mostrarConvite(false)
  const bloco = el('div', 'da-ia')

  if (turno.texto) bloco.append(el('p', 'prosa', turno.texto))
  if (turno.rig) {
    envelhecerCartoes()
    bloco.append(montarCartoes(turno.rig, turno.cartoes))
  }

  mensagens.append(bloco)
  sincronizarAplicar()
  aoFim()
  return bloco
}

function limparConversa(): void {
  mensagens.replaceChildren()
  mostrarConvite(true)
  $<HTMLElement>('stat-amp').hidden = true
  esconderPlugin()
}

/** Redesenha uma conversa inteira vinda do histórico. */
function pintarConversa(aberta: Aberta): void {
  mensagens.replaceChildren()

  for (const m of aberta.mensagens) {
    if (m.papel === 'usuario') addUsuario(m.texto)
    else if (m.papel === 'erro') addErro(m.texto)
    else addTurno({ texto: m.texto, rig: m.rig ?? null, cartoes: m.cartoes ?? null })
  }

  mostrarConvite(aberta.mensagens.length === 0)

  if (aberta.memoriaPerdida) {
    const aviso = el('div', 'da-ia')
    aviso.append(
      el(
        'p',
        'aviso',
        'O histórico desta conversa não pôde ser reaproveitado — ela foi criada com outro provedor de IA ou por uma versão anterior da app. O texto está aqui, mas o modelo não lembra dela: descreva de novo o que você quer ajustar.',
      ),
    )
    mensagens.append(aviso)
  }

  aoFim()
}

// ------------------------------------------------------------------ aplicar

async function aplicar(
  nome: string,
  cartao: HTMLElement,
  botao: HTMLButtonElement,
  carimbo: HTMLElement,
): Promise<void> {
  const r = await api.aplicar(nome)

  cartao.querySelector('.aviso')?.remove()

  if ('erro' in r) {
    cartao.append(el('p', 'aviso', r.erro))
    return
  }

  // Só um cartão fica marcado: é o espelho do estado real do plugin, que só
  // consegue estar numa cena por vez.
  for (const outro of Array.from(document.querySelectorAll('.cartao.aplicado'))) {
    outro.classList.remove('aplicado')
  }
  cartao.classList.add('aplicado')

  // A marca sobrevive à confirmação verde: é ela que faz `sincronizarAplicar`
  // manter "Aplicar de novo" quando a barra do plugin é reconsultada depois.
  botao.dataset.aplicado = '1'

  botao.classList.add('feito')
  rotularAplicar(botao, 'Aplicado', 'i-ok')
  setTimeout(() => {
    botao.classList.remove('feito')
    rotularAplicar(botao, 'Aplicar de novo', 'i-aplicar')
  }, MS_CONFIRMACAO)

  carimbo.hidden = false
  carimbo.textContent = `aplicado às ${hora()} · ${r.ccsSent} CCs em ${r.ms.toFixed(0)} ms`

  if (r.avisos.length > 0) cartao.append(el('p', 'aviso', r.avisos.join(' · ')))

  const ampAtual = $<HTMLElement>('stat-amp')
  ampAtual.hidden = false
  ampAtual.textContent = r.amp
}

/**
 * Aplica sozinha quando o modo automático está ligado e a rig trouxe uma
 * sugestão só. Duas ou mais cenas (`base` + `solo`, por exemplo) nunca
 * disparam isto: qual delas aplicar é escolha do guitarrista, não da app.
 *
 * Clicar no botão via `.click()`, e não chamar `aplicar()` direto, não é
 * atalho — é o que faz o modo automático herdar de graça toda a lógica que já
 * existe no clique manual (cartão fica "aplicado", carimbo de horário, aviso
 * de erro) sem duplicar nada. E como elemento desabilitado não dispara evento
 * de clique, o guard de "plugin fechado" que `sincronizarAplicar` já aplicou
 * ao botão vale automaticamente aqui — não precisa ser conferido de novo.
 */
function tentarAutoAplicar(rig: Rig, bloco: HTMLElement): void {
  if (!autoAplicarLigado) return
  if (Object.keys(rig.cenas).length !== 1) return
  bloco.querySelector<HTMLButtonElement>('.aplicar')?.click()
}

// -------------------------------------------------------- barra do plugin

const barra = $<HTMLDivElement>('plugin-bar')
const btnAbrirPlugin = $<HTMLButtonElement>('plugin-abrir')
const linhaMap = $<HTMLDivElement>('plugin-map')

const TEXTO_MAPEAMENTO: Record<EstadoPlugin['mapeamento'], string> = {
  ok: '',
  ausente: 'Mapeamento MIDI não instalado',
  desatualizado: 'Mapeamento MIDI desatualizado',
}

/**
 * O plugin demora alguns segundos entre o `spawn` e aparecer no `tasklist`.
 * Sem esta marca a barra voltaria imediatamente para "não está aberto" logo
 * depois do clique, e o guitarrista clicaria de novo achando que falhou.
 *
 * O prazo existe para o caso de o plugin não subir (instalação quebrada, Windows
 * pedindo elevação): passado ele, a barra volta a oferecer o botão em vez de
 * ficar dizendo "Abrindo…" para sempre.
 */
const MS_ABRINDO = 25000
let abrindoAte = 0

function pintarPlugin(e: EstadoPlugin): void {
  barra.hidden = false
  destino = nomeCurto(e.nome)
  $<HTMLElement>('dica-destino').textContent = `Valores calculados para ${destino}`

  const led = $<HTMLElement>('plugin-led')
  const texto = $<HTMLElement>('plugin-texto')

  pluginAberto = e.instalado && e.rodando

  if (!e.instalado) {
    barra.className = 'plugin-bar erro'
    led.className = 'led erro'
    texto.textContent = `${destino} não está instalado neste computador`
    btnAbrirPlugin.hidden = true
  } else if (e.rodando) {
    abrindoAte = 0
    barra.className = 'plugin-bar'
    led.className = 'led ligado'
    texto.textContent = `${destino} aberto — pronto para receber os timbres`
    btnAbrirPlugin.hidden = true
  } else if (Date.now() < abrindoAte) {
    barra.className = 'plugin-bar atencao'
    led.className = 'led atencao'
    texto.textContent = `Abrindo o ${destino}…`
    btnAbrirPlugin.hidden = false
    btnAbrirPlugin.disabled = true
    btnAbrirPlugin.textContent = 'Abrindo…'
  } else {
    barra.className = 'plugin-bar atencao'
    led.className = 'led atencao'
    texto.textContent = `${destino} não está aberto — abra para aplicar os timbres`
    btnAbrirPlugin.hidden = false
    btnAbrirPlugin.disabled = false
    btnAbrirPlugin.textContent = `Abrir ${destino}`
  }

  const problema = e.mapeamento !== 'ok'
  linhaMap.hidden = !problema
  if (problema) {
    $<HTMLElement>('plugin-map-texto').textContent = TEXTO_MAPEAMENTO[e.mapeamento]
    $<HTMLButtonElement>('plugin-map-btn').hidden = false
    $<HTMLButtonElement>('plugin-map-btn').disabled = false
    $<HTMLButtonElement>('plugin-map-btn').textContent = 'Instalar'
  }

  sincronizarAplicar()
}

function esconderPlugin(): void {
  barra.hidden = true
  pluginAtual = null
  pluginAberto = false
  $<HTMLElement>('dica-destino').textContent = ''
  sincronizarAplicar()
}

async function atualizarPlugin(id: string | null): Promise<void> {
  if (!id) {
    esconderPlugin()
    return
  }
  pluginAtual = id
  const e = await api.estadoPlugin(id)
  if ('erro' in e) {
    esconderPlugin()
    return
  }
  pintarPlugin(e)
}

btnAbrirPlugin.addEventListener('click', async () => {
  if (!pluginAtual) return
  abrindoAte = Date.now() + MS_ABRINDO
  btnAbrirPlugin.disabled = true
  btnAbrirPlugin.textContent = 'Abrindo…'

  const r = await api.abrirPlugin(pluginAtual)
  if ('erro' in r) {
    abrindoAte = 0
    addErro(r.erro)
    btnAbrirPlugin.disabled = false
    btnAbrirPlugin.textContent = `Abrir ${destino}`
    return
  }
  // Daqui em diante quem avisa que o plugin subiu é o `onPlugin` do main, que
  // consulta o sistema a cada poucos segundos. A tela não precisa mais agendar
  // reconsultas próprias — e, ao contrário delas, o vigia continua depois,
  // percebendo também quando o plugin **fecha**.
  pintarPlugin(r)
})

/**
 * O plugin abriu, fechou ou teve o mapeamento mexido por fora. Sem isto a barra
 * congelava no estado do último clique: fechar o plugin no meio da sessão
 * deixava a tela dizendo "aberto" e os botões de aplicar habilitados, mandando
 * CC para ninguém.
 */
api.onPlugin((e) => {
  // Um evento de outro plugin chegaria só numa corrida entre trocar de conversa
  // e o tique do vigia; ignorar é mais barato do que sincronizar.
  if (e.id !== pluginAtual) return
  pintarPlugin(e)
})

$<HTMLButtonElement>('plugin-map-btn').addEventListener('click', async () => {
  if (!pluginAtual) return
  const btn = $<HTMLButtonElement>('plugin-map-btn')
  btn.disabled = true

  const r = await api.instalarMapeamento(pluginAtual)
  if ('erro' in r) {
    addErro(r.erro)
    btn.disabled = false
    return
  }

  pintarPlugin(r)
  // Copiar o arquivo é metade: carregar no plugin a app não consegue fazer.
  linhaMap.hidden = false
  $<HTMLElement>('plugin-map-texto').textContent =
    'Instalado — carregue em Settings → MIDI Mappings → Load'
  btn.hidden = true
})

// ------------------------------------------------------------------- status

const TEXTO_STATUS: Record<Exclude<StatusChat, null>, string> = {
  consultando: 'Consultando a IA…',
  validando: 'Montando os timbres…',
  corrigindo: 'Corrigindo o timbre…',
}

function mostrarStatus(s: StatusChat): void {
  if (!s) {
    pilula?.remove()
    pilula = null
    return
  }
  if (!pilula) {
    pilula = el('div', 'trabalhando')
    pilula.append(el('span', 'giro'), el('span', undefined, ''))
    mensagens.append(pilula)
  }
  pilula.lastElementChild!.textContent = TEXTO_STATUS[s]
  aoFim()
}

api.onStatus(mostrarStatus)

// ------------------------------------------------------------------- envio

function travar(valor: boolean): void {
  ocupado = valor
  entrada.disabled = valor
  btnEnviar.disabled = valor
}

async function enviar(texto: string): Promise<void> {
  const limpo = texto.trim()
  if (!limpo || ocupado) return

  addUsuario(limpo)
  entrada.value = ''
  ajustarAltura()
  travar(true)
  mostrarStatus('consultando')

  try {
    const r = await api.enviar(limpo)
    if ('erro' in r) {
      addErro(r.erro)
    } else {
      const bloco = addTurno(r)
      if (r.rig) {
        // A IA escolhe o plugin chamando a tool dele — é aqui que a barra do
        // topo descobre qual app o guitarrista precisa ter aberto. Isso
        // precisa vir ANTES do modo automático: é `atualizarPlugin` quem
        // decide se o botão está habilitado, e testar a habilitação com o
        // estado do plugin anterior aplicaria (ou recusaria aplicar) no app
        // errado.
        await atualizarPlugin(r.rig.plugin)
        tentarAutoAplicar(r.rig, bloco)
      }
    }
    // O título e a data de uma conversa mudam a cada turno.
    await recarregarHistorico()
  } finally {
    mostrarStatus(null)
    travar(false)
    entrada.focus()
  }
}

function ajustarAltura(): void {
  entrada.style.height = 'auto'
  entrada.style.height = `${Math.min(entrada.scrollHeight, 150)}px`
}

entrada.addEventListener('input', ajustarAltura)
entrada.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void enviar(entrada.value)
  }
})
btnEnviar.addEventListener('click', () => void enviar(entrada.value))

// -------------------------------------------------------------- modo de aplicação

/**
 * Botão + menu para cima, no espírito do seletor Auto/Edit/Plan do Claude
 * Code: em vez de um clique só alternando dois estados às cegas, o guitarrista
 * vê o nome e a frase de cada modo antes de escolher. O padrão é sempre
 * Manual — `pintarModoAuto(false)` é o que `pintarEstado` chama na primeira
 * pintura, espelhando o `autoAplicar: false` que `janela.ts` grava por padrão.
 */
const btnModoAuto = $<HTMLButtonElement>('btn-modo-auto')
const modoMenu = $<HTMLDivElement>('modo-menu')
const opcoesModo = Array.from(document.querySelectorAll<HTMLButtonElement>('.modo-opcao'))

function fecharModoMenu(): void {
  modoMenu.hidden = true
  btnModoAuto.setAttribute('aria-expanded', 'false')
}

function pintarModoAuto(ligado: boolean): void {
  autoAplicarLigado = ligado
  btnModoAuto.classList.toggle('ligado', ligado)
  btnModoAuto.querySelector('use')!.setAttribute('href', ligado ? '#i-raio' : '#i-editar')
  btnModoAuto.querySelector('span')!.textContent = ligado ? 'Auto' : 'Manual'
  for (const opcao of opcoesModo) {
    opcao.setAttribute('aria-pressed', String((opcao.dataset.modo === 'auto') === ligado))
  }
}

btnModoAuto.addEventListener('click', (e) => {
  // Sem isto, este clique chegaria ao listener de "fechar ao clicar fora" logo
  // abaixo e fecharia o menu no mesmo instante em que abriu — mesmo padrão que
  // o botão ☰ já usa para o menu dele.
  e.stopPropagation()
  const abrir = modoMenu.hidden
  modoMenu.hidden = !abrir
  btnModoAuto.setAttribute('aria-expanded', String(abrir))
})

for (const opcao of opcoesModo) {
  opcao.addEventListener('click', () => {
    const querAuto = opcao.dataset.modo === 'auto'
    fecharModoMenu()
    if (querAuto === autoAplicarLigado) return
    void api.definirAutoAplicar(querAuto).then(pintarModoAuto)
  })
}

document.addEventListener('click', (e) => {
  if (!modoMenu.hidden && !modoMenu.contains(e.target as Node)) fecharModoMenu()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modoMenu.hidden) fecharModoMenu()
})

// ----------------------------------------------------------------- histórico

async function recarregarHistorico(): Promise<void> {
  pintarHistorico(await api.listarConversas())
}

function pintarHistorico(conversas: Resumo[]): void {
  if (conversas.length === 0) {
    lista.replaceChildren(el('p', 'vazio', 'Nenhuma conversa salva ainda.'))
    return
  }

  lista.replaceChildren()
  for (const c of conversas) {
    const linha = el('div', c.id === conversaAtual ? 'conversa atual' : 'conversa')

    const abrir = el('button', 'conversa-abrir')
    abrir.type = 'button'
    abrir.append(
      el('span', 'conversa-titulo', c.titulo),
      el(
        'span',
        'conversa-meta',
        `${quando(c.atualizadaEm)} · ${c.turnos} pedido${c.turnos === 1 ? '' : 's'}`,
      ),
    )
    abrir.addEventListener('click', () => void abrirConversa(c.id))

    const apagar = el('button', 'conversa-apagar')
    apagar.type = 'button'
    apagar.title = 'Apagar esta conversa'
    apagar.append(icone('i-lixo'))
    apagar.addEventListener('click', async () => {
      const restantes = await api.apagarConversa(c.id)
      if (conversaAtual === c.id) {
        conversaAtual = null
        limparConversa()
      }
      pintarHistorico(restantes)
    })

    linha.append(abrir, apagar)
    lista.append(linha)
  }
}

async function abrirConversa(id: string): Promise<void> {
  const r = await api.abrirConversa(id)
  if ('erro' in r) {
    abrirAba('chat')
    addErro(r.erro)
    return
  }

  conversaAtual = r.id
  pintarConversa(r)
  $<HTMLElement>('stat-amp').hidden = true
  await atualizarPlugin(r.plugin)
  abrirAba('chat')
  await recarregarHistorico()
}

async function novaConversa(): Promise<void> {
  await api.novaConversa()
  conversaAtual = null
  limparConversa()
  abrirAba('chat')
  await recarregarHistorico()
}

$<HTMLButtonElement>('btn-nova').addEventListener('click', () => void novaConversa())

// -------------------------------------------------------------------- abas

const PANES = ['chat', 'historico', 'config', 'sobre']

function abrirAba(nome: string): void {
  for (const tab of Array.from(document.querySelectorAll<HTMLElement>('[data-pane]'))) {
    tab.setAttribute('aria-selected', String(tab.dataset.pane === nome))
  }
  // Alternar aba só esconde: o conteúdo da conversa continua no DOM, intacto.
  for (const p of PANES) $<HTMLElement>(`pane-${p}`).hidden = p !== nome
  if (nome === 'chat') entrada.focus()
  if (nome === 'historico') void recarregarHistorico()
}

for (const tab of Array.from(document.querySelectorAll<HTMLElement>('[data-pane]'))) {
  tab.addEventListener('click', () => abrirAba(tab.dataset.pane!))
}

// -------------------------------------------------------------------- menu

const menu = $<HTMLDivElement>('menu')
const btnMenu = $<HTMLButtonElement>('btn-menu')

function fecharMenu(): void {
  menu.hidden = true
  btnMenu.setAttribute('aria-expanded', 'false')
}

btnMenu.addEventListener('click', (e) => {
  e.stopPropagation()
  menu.hidden = !menu.hidden
  btnMenu.setAttribute('aria-expanded', String(!menu.hidden))
})
document.addEventListener('click', (e) => {
  if (!menu.hidden && !menu.contains(e.target as Node)) fecharMenu()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !menu.hidden) fecharMenu()
})

$<HTMLButtonElement>('m-config').addEventListener('click', () => {
  fecharMenu()
  abrirAba('config')
})
$<HTMLButtonElement>('m-sobre').addEventListener('click', () => {
  fecharMenu()
  abrirAba('sobre')
})

$<HTMLInputElement>('m-topo').addEventListener('change', async () => {
  $<HTMLInputElement>('m-topo').checked = await api.alternarTopo()
})

$<HTMLInputElement>('m-escurecer').addEventListener('change', (e) => {
  void api.definirEscurecer((e.target as HTMLInputElement).checked)
})

// ------------------------------------------------------------------ barra

function pintarEstado(e: Estado): void {
  const dot = $<HTMLElement>('dot-midi')
  const txt = $<HTMLElement>('txt-midi')
  const stat = $<HTMLElement>('stat-midi')

  if (e.midi.porta) {
    dot.className = 'dot ok'
    txt.textContent = e.midi.porta
    stat.title = 'Porta MIDI aberta'
  } else {
    dot.className = 'dot erro'
    txt.textContent = 'sem MIDI'
    stat.title = e.midi.erro ?? 'Porta MIDI fechada'
  }

  pintarModelo(e)

  $<HTMLInputElement>('m-topo').checked = e.sempreNoTopo
  $<HTMLInputElement>('m-escurecer').checked = e.escurecerSemFoco
  pintarModoAuto(e.autoAplicar)

  marcarTema(e.tema.escolhido)
  // O atributo já está certo na maioria das chamadas; o que o repintar cobre é
  // o `sistema` que mudou de valor enquanto a janela estava fechada.
  pintarTema(e.tema.resolvido)
  pintarChaves(e)

  $<HTMLElement>('sobre-versao').textContent = `Versão ${e.versao}`

  $<HTMLInputElement>('g-modelo').value = e.guitarra.modelo
  $<HTMLSelectElement>('g-captadores').value = e.guitarra.captadores
  $<HTMLSelectElement>('g-cordas').value = String(e.guitarra.cordas)
  $<HTMLInputElement>('g-afinacao').value = e.guitarra.afinacao
}

/*
 * Modelo de IA — botão + painel, não `<select>`: com as duas chaves válidas a
 * lista mistura GPT e Claude, tem busca e agrupa por faixa de custo
 * (`nivelCusto`, deduzida do nome — nenhum dos dois provedores devolve
 * preço). Mesmo padrão de abrir/fechar do `.modo-menu` logo abaixo, só que
 * ancorado à ESQUERDA — ver o comentário no CSS antes de mexer no lado.
 */
const btnModelo = $<HTMLButtonElement>('btn-modelo')
const modeloRotulo = $<HTMLElement>('modelo-rotulo')
const modeloMenu = $<HTMLDivElement>('modelo-menu')
const modeloFiltro = $<HTMLInputElement>('modelo-filtro')
const modeloLista = $<HTMLDivElement>('modelo-lista')

let disponiveis: ModeloDisponivel[] = []
let ativoProvider: string | null = null
let ativoModel: string | null = null

function fecharModeloMenu(): void {
  modeloMenu.hidden = true
  btnModelo.setAttribute('aria-expanded', 'false')
}

/**
 * `"gpt-5.6-sol"` → `"GPT-5.6 Sol"`. Só a família `gpt-*` ganha esse
 * tratamento — o id da Anthropic já é o nome de exibição (`claude-opus-5`).
 */
function rotuloModelo(m: ModeloDisponivel): string {
  if (m.provider !== 'openai') return m.id
  const partes = /^gpt-(\d+(?:\.\d+)?)(?:-([a-z0-9]+))?$/i.exec(m.id)
  if (!partes) return m.id
  const [, versao, codinome] = partes
  const sufixo = codinome ? ` ${codinome.charAt(0).toUpperCase()}${codinome.slice(1)}` : ''
  return `GPT-${versao}${sufixo}`
}

function renderModelos(filtro: string): void {
  modeloLista.replaceChildren()
  const termo = filtro.trim().toLowerCase()
  // Só mostra de qual provedor é cada modelo quando a lista de fato mistura
  // os dois — com um catálogo só, o rótulo repetiria a mesma coisa em toda
  // linha e só ocuparia espaço.
  const misturado = new Set(disponiveis.map((m) => m.provider)).size > 1

  // Sem agrupamento: a ordem já vem do backend com o melhor modelo de cada
  // provedor no topo (ver `openai.ts`/`anthropic.ts`) — bucket por faixa de
  // custo só escondia essa ordem atrás de rótulos que ninguém pediu.
  const filtrados = disponiveis.filter((m) => !termo || m.id.toLowerCase().includes(termo))

  for (const m of filtrados) {
    const item = el('button', 'modelo-item')
    item.type = 'button'
    item.setAttribute('role', 'menuitemradio')
    const selecionado = m.provider === ativoProvider && m.id === ativoModel
    item.setAttribute('aria-checked', String(selecionado))

    const marca = icone('i-ok')
    marca.classList.add('modelo-marca')
    item.append(marca)

    const texto = el('span')
    texto.append(el('b', undefined, rotuloModelo(m)))
    if (misturado) texto.append(el('em', undefined, m.providerLabel))
    item.append(texto)

    item.addEventListener('click', async () => {
      fecharModeloMenu()
      if (selecionado) return
      btnModelo.disabled = true
      const r = await api.escolherModelo(m.provider, m.id)
      btnModelo.disabled = false
      if ('erro' in r) {
        addErro(r.erro)
        return
      }
      pintarEstado(r)
    })

    modeloLista.append(item)
  }

  if (!modeloLista.children.length) {
    modeloLista.append(el('p', 'modelo-vazio', 'Nenhum modelo encontrado.'))
  }
}

function pintarModelo(e: Estado): void {
  const ia = e.ia
  if (ia) {
    disponiveis = ia.disponiveis
    ativoProvider = ia.provider
    ativoModel = ia.model
    const atual = disponiveis.find((m) => m.provider === ia.provider && m.id === ia.model)
    modeloRotulo.textContent = atual ? rotuloModelo(atual) : ia.model
    btnModelo.title = `${ia.label} — ${ia.model}`
    btnModelo.disabled = false
  } else {
    disponiveis = []
    ativoProvider = null
    ativoModel = null
    modeloRotulo.textContent = 'sem IA'
    btnModelo.title = e.iaErro ?? 'Nenhuma chave de IA válida'
    btnModelo.disabled = true
  }
}

btnModelo.addEventListener('click', (e) => {
  // Mesmo motivo do `.modo-auto`: sem isto, o listener de "fechar ao clicar
  // fora" (abaixo) fecharia o painel no mesmo clique que abriu.
  e.stopPropagation()
  if (btnModelo.disabled) return

  const abrir = modeloMenu.hidden
  modeloMenu.hidden = !abrir
  btnModelo.setAttribute('aria-expanded', String(abrir))
  if (abrir) {
    modeloFiltro.value = ''
    renderModelos('')
    modeloFiltro.focus()
  }
})

modeloFiltro.addEventListener('input', () => renderModelos(modeloFiltro.value))
// O painel abre com Enter/Espaço no botão — sem isto o Enter chegaria ao
// campo de busca vazio e o painel fecharia sem escolher nada.
modeloFiltro.addEventListener('keydown', (e) => e.stopPropagation())

document.addEventListener('click', (e) => {
  if (!modeloMenu.hidden && !modeloMenu.contains(e.target as Node)) fecharModeloMenu()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modeloMenu.hidden) fecharModeloMenu()
})

// ------------------------------------------------------------------ config

$<HTMLButtonElement>('btn-salvar').addEventListener('click', async () => {
  const nota = $<HTMLElement>('nota-salvar')
  const r = await api.salvarGuitarra({
    modelo: $<HTMLInputElement>('g-modelo').value.trim(),
    captadores: $<HTMLSelectElement>('g-captadores').value as Estado['guitarra']['captadores'],
    afinacao: $<HTMLInputElement>('g-afinacao').value.trim() || 'E padrão',
    cordas: Number($<HTMLSelectElement>('g-cordas').value),
  })

  nota.hidden = false
  if ('erro' in r) {
    nota.textContent = r.erro
    return
  }

  // A conversa continua exatamente onde estava: o main recria a sessão com o
  // prompt novo e o mesmo histórico, então nada na tela precisa ser apagado.
  pintarEstado(r)
  nota.textContent = 'Guitarra salva. A conversa continua, agora considerando este instrumento.'
})

// --------------------------------------------------------------------- tema

const segTema = $<HTMLDivElement>('seg-tema')

function botoesDeTema(): HTMLButtonElement[] {
  return Array.from(segTema.querySelectorAll<HTMLButtonElement>('[data-tema]'))
}

function marcarTema(escolhido: Tema): void {
  for (const b of botoesDeTema()) {
    b.setAttribute('aria-checked', String(b.dataset.tema === escolhido))
  }
}

for (const botao of botoesDeTema()) {
  botao.addEventListener('click', async () => {
    // Quem resolve `sistema` é o main, junto com o fundo da janela e os botões
    // nativos da barra de título — por isso a troca volta pelo estado inteiro
    // em vez de a tela mudar o atributo sozinha.
    pintarEstado(await api.definirTema(botao.dataset.tema as Tema))
  })
}

// ------------------------------------------------------------------- chaves

const caixaChaves = $<HTMLDivElement>('chaves')
const notaIa = $<HTMLElement>('nota-ia')
const selProvedor = $<HTMLSelectElement>('ia-provedor')

const SELO: Record<Chave['origem'], string> = {
  app: 'em uso',
  ambiente: 'do .env',
  nenhuma: 'sem chave',
}

function avisarIa(texto: string): void {
  notaIa.hidden = false
  notaIa.textContent = texto
}

/** Fecha uma ação de chave ou de provedor: repinta tudo e diz quem atende agora. */
function concluirIa(r: Resultado<Estado>, feito: string): void {
  if ('erro' in r) {
    avisarIa(r.erro)
    return
  }

  pintarEstado(r)
  avisarIa(
    r.ia
      ? `${feito} Atendendo agora: ${r.ia.label}, modelo ${r.ia.model}.`
      : `${feito} ${r.iaErro ?? 'Nenhuma chave está valendo.'}`,
  )
}

function detalheDa(c: Chave): string {
  if (!c.dica) {
    return c.origem === 'ambiente'
      ? `Sem chave salva aqui — a app está usando ${c.env} do ambiente.`
      : `Nenhuma chave. Sem ela a ${c.label} não pode ser eleita.`
  }
  if (!c.legivel) {
    return 'Salva, mas esta conta do Windows não consegue decifrá-la — cole a chave de novo.'
  }
  // "em texto puro" não é detalhe de implementação: é a diferença entre o
  // arquivo ser inútil e ser suficiente para alguém usar a conta.
  const modo = c.protegida ? 'cifrada nesta conta' : 'em texto puro'
  return `${c.dica} · ${modo} · ${quando(c.atualizadaEm!)}`
}

function montarChave(c: Chave): HTMLElement {
  const bloco = el('div', 'chave')

  const topo = el('div', 'chave-topo')
  topo.append(el('b', undefined, c.label), el('span', `selo ${c.origem}`, SELO[c.origem]))
  bloco.append(topo, el('p', 'chave-dica', detalheDa(c)))

  const campo = el('input', 'control')
  campo.type = 'password'
  campo.autocomplete = 'off'
  campo.spellcheck = false
  campo.placeholder = c.dica ? 'Colar outra chave…' : 'Colar a chave…'

  const salvar = el('button', 'save', 'Salvar')
  salvar.type = 'button'

  async function salvarChave(): Promise<void> {
    if (!campo.value.trim()) {
      avisarIa(`Cole a chave da ${c.label} antes de salvar.`)
      return
    }
    salvar.disabled = true
    const r = await api.salvarChave(c.provedor, campo.value)
    // A chave em claro não fica no DOM nem para o próximo repintar.
    campo.value = ''
    salvar.disabled = false
    concluirIa(r, `Chave da ${c.label} salva.`)
  }

  salvar.addEventListener('click', () => void salvarChave())
  campo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void salvarChave()
  })

  const acoes = el('div', 'chave-acoes')
  acoes.append(campo, salvar)

  if (c.dica) {
    const remover = el('button', 'ghost', 'Remover')
    remover.type = 'button'
    remover.addEventListener('click', async () => {
      remover.disabled = true
      concluirIa(await api.removerChave(c.provedor), `Chave da ${c.label} removida.`)
    })
    acoes.append(remover)
  }

  bloco.append(acoes)
  return bloco
}

function pintarChaves(e: Estado): void {
  selProvedor.value = e.preferencia
  // `AI_PROVIDER` no ambiente vence a preferência da janela — o seletor diz
  // isso em vez de fingir que manda e ser desmentido na próxima mensagem.
  selProvedor.disabled = Boolean(e.provedorForcado)
  selProvedor.title = e.provedorForcado
    ? `AI_PROVIDER=${e.provedorForcado} está definida no ambiente e tem precedência.`
    : ''

  caixaChaves.replaceChildren(
    ...(e.chavesErro ? [el('p', 'erro', e.chavesErro)] : e.chaves.map(montarChave)),
  )
}

selProvedor.addEventListener('change', async () => {
  selProvedor.disabled = true
  const r = await api.preferirProvedor(selProvedor.value as Preferencia)
  selProvedor.disabled = false
  concluirIa(r, 'Provedor atualizado.')
})

// -------------------------------------------------------------------- boot

async function iniciar(): Promise<void> {
  const captadores = $<HTMLSelectElement>('g-captadores')
  for (const c of CAPTADORES) {
    const opt = document.createElement('option')
    opt.value = c
    opt.textContent = c
    captadores.append(opt)
  }

  const sugestoes = $<HTMLDivElement>('sugestoes')
  for (const s of SUGESTOES) {
    const chip = el('button', 'sugestao', s)
    chip.type = 'button'
    chip.addEventListener('click', () => void enviar(s))
    sugestoes.append(chip)
  }

  pintarEstado(await api.estado())
  await recarregarHistorico()
  abrirAba('chat')
}

void iniciar()

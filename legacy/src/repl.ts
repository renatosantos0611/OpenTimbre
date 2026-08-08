/**
 * REPL principal (`npm run dev`).
 *
 * O parser recebe uma `string` e é indiferente à origem — hoje vem do teclado,
 * amanhã pode vir de um STT sem nada mudar aqui.
 */

import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import chalk from 'chalk'
import Table from 'cli-table3'
import * as library from './library.js'
import * as midi from './midi-out.js'
import { ampsMapeados, exigir, getAmpStrategy, padrao } from './plugins/index.js'
import { knownProviders, resolveProvider } from './provider.js'
import { ajustarCena, buildRig, loadSystemPrompt } from './rig-builder.js'
import { checkScope } from './scope.js'
import { rigJsonSchema, toolName, type Rig } from './schema.js'
import { LOG_FILE, TRACE_MODES, getTraceMode, setTraceMode } from './trace.js'

const HELP = `
${chalk.bold('Comandos')}
  ${chalk.cyan('rig <música>')}        gera (ou carrega do cache) e aplica a cena base
  ${chalk.cyan('regerar <música>')}    ignora o cache e gera de novo (gasta token)
  ${chalk.cyan('cena <nome>')}         troca de cena na música carregada
  ${chalk.cyan('ajustar <instrução>')} ajusta a cena atual por instrução livre ("mais grave")
  ${chalk.cyan('show')}                imprime o rig atual em tabela
  ${chalk.cyan('rigs')}                lista as rigs em cache (carregue com \`rig <slug>\`)
  ${chalk.cyan('learn <cc>')}          entra em modo MIDI Learn (\`stop\` interrompe)
  ${chalk.cyan('sweep <cc>')}          varre o CC de 0 a 127
  ${chalk.cyan('set <cc> <valor>')}    manda um CC pontual
  ${chalk.cyan('amptest')}             testa o seletor de amplificador
  ${chalk.cyan('provider')}            mostra qual IA está em uso e revalida as chaves
  ${chalk.cyan('reload')}              recarrega o system prompt do disco
  ${chalk.cyan('trace [modo]')}        ${TRACE_MODES.join('|')} — mostra o que vai e volta da IA
  ${chalk.cyan('prompt')}              imprime o system prompt montado (sem chamar a API)
  ${chalk.cyan('schema')}              imprime o JSON Schema da tool (sem chamar a API)
  ${chalk.cyan('help')}                esta ajuda
  ${chalk.cyan('quit')}                sai
`

// O REPL opera sobre um plugin de cada vez — o primeiro do catálogo. Quem
// escolhe entre plugins é a IA, na janela desktop.
const plugin = padrao()
const strategy = getAmpStrategy(plugin)

let systemPrompt = loadSystemPrompt()
let rig: Rig | null = null
let cenaAtual = ''
let slugAtual = ''

// ------------------------------------------------------------------- saída

function showRig(r: Rig, active: string): void {
  const spec = exigir(r.plugin)
  console.log(
    `\n${chalk.bold(r.musica)} ${chalk.dim('—')} ${r.artista}   ` +
      `${chalk.dim(spec.nome)}   amp ${chalk.yellow(r.amp)} ${chalk.dim(`(${spec.ampDesc[r.amp] ?? ''})`)}`,
  )
  console.log(chalk.dim(`  ${r.nota}\n`))

  const nomes = Object.keys(r.cenas)
  const table = new Table({
    head: [chalk.bold('parâmetro'), chalk.bold('cc'), ...nomes.map((n) => chalk.bold(n === active ? `${n} *` : n))],
    style: { head: [], border: [] },
  })

  const cellsFor = (name: string) =>
    nomes.map((n) => {
      const v = (r.cenas[n]?.params as Record<string, unknown> | undefined)?.[name]
      if (v === undefined) return chalk.dim('–')
      if (typeof v === 'boolean') return v ? chalk.green('on') : chalk.dim('off')
      return String(v)
    })

  // O CC dos parâmetros do amp depende do amplificador da rig; '–' quando esse
  // amp não tem esse controle no plugin (o CLN não tem Master nem Presence).
  const ampCCs = spec.ampCC[r.amp] ?? {}
  for (const name of Object.keys(spec.ampParams)) {
    const cc = ampCCs[name]
    table.push([name, cc === undefined ? chalk.red('–') : chalk.dim(String(cc)), ...cellsFor(name)])
  }

  for (const [name, p] of Object.entries(spec.params)) {
    table.push([name, chalk.dim(String(p.cc)), ...cellsFor(name)])
  }

  console.log(table.toString())
  console.log(chalk.dim(`  * cena aplicada    estratégia de amp: ${strategy.name}\n`))
}

function aplicar(nome: string): void {
  if (!rig) throw new Error('Nenhuma rig carregada. Use `rig <música>` primeiro.')

  const cena = rig.cenas[nome]
  if (!cena) {
    throw new Error(
      `Cena '${nome}' não existe. Disponíveis: ${Object.keys(rig.cenas).join(', ')}`,
    )
  }

  const started = performance.now()
  const { amp, ampInstruction, warning, ccsSent } = midi.applyScene(
    exigir(rig.plugin),
    cena.params,
    rig.amp,
    strategy,
  )
  const ms = performance.now() - started

  cenaAtual = nome
  console.log(
    chalk.green(`Cena '${nome}' aplicada`) +
      chalk.dim(` — amp ${amp}, ${ccsSent} CCs em ${ms.toFixed(1)}ms`),
  )
  console.log(chalk.dim(`  ${cena.titulo}`))
  if (warning) console.log(chalk.yellow(`  ! ${warning}`))
  if (ampInstruction) console.log(chalk.yellow(`  ! ${ampInstruction}`))
}

// ----------------------------------------------------------------- comandos

function parseCC(arg: string | undefined): number {
  const cc = Number(arg)
  if (!Number.isInteger(cc) || cc < 0 || cc > 127) {
    throw new Error(`CC inválido: '${arg ?? ''}' (esperado inteiro 0–127)`)
  }
  return cc
}

async function cmdRig(pedido: string, forcar = false): Promise<void> {
  if (!pedido) throw new Error(`Uso: ${forcar ? 'regerar' : 'rig'} <música>`)

  const scope = checkScope(pedido)
  if (!scope.inScope) {
    console.log(chalk.red(`Fora de escopo: ${scope.reason}.`))
    return
  }

  let slug = library.slugify(pedido)
  let cached = forcar ? null : library.load(slug)

  // Sem acerto exato, procura no cache por aproximação — o slug vem da frase
  // digitada, então "sweet child o mine" não bate com uma rig salva como
  // "configurar amp para musica sweet child o mine", e sem isso a app gastaria
  // outra chamada de API para gerar a mesma coisa.
  if (!cached && !forcar) {
    const candidatos = library.find(pedido)
    if (candidatos.length === 1) {
      slug = candidatos[0]!.slug
      cached = library.load(slug)
      console.log(chalk.dim(`Encontrada no cache por aproximação: rigs/${slug}.json`))
    } else if (candidatos.length > 1) {
      console.log(chalk.yellow('Mais de uma rig em cache combina com esse pedido:'))
      for (const c of candidatos) {
        console.log(`  ${chalk.cyan(c.slug)}  ${chalk.dim(`— ${c.musica} / ${c.artista}`)}`)
      }
      console.log(
        chalk.dim('\nRode `rig <slug>` com um deles, ou `regerar <música>` para gerar uma nova.'),
      )
      return
    }
  }

  let nova: Rig
  if (cached) {
    nova = cached
    console.log(chalk.dim(`Carregado do cache: rigs/${slug}.json`))
  } else {
    // A primeira chamada resolve o provedor (testa as chaves); as seguintes
    // reusam o cache, então esta linha só demora de verdade uma vez.
    const { chosen } = await resolveProvider()
    console.log(chalk.dim(`Consultando ${chosen.label} (${chosen.model()})...`))
    nova = await buildRig(plugin, pedido, systemPrompt)
    const file = library.save(slug, nova)
    console.log(chalk.dim(`Salvo em ${file}`))
  }

  // Troca o estado só depois que tudo deu certo. Se o `buildRig` falhar, a rig
  // anterior continua carregada e coerente com o seu slug — senão o próximo
  // `ajustar` gravaria a rig antiga no arquivo da música nova.
  rig = nova
  slugAtual = slug
  cenaAtual = ''

  showRig(rig, 'base')
  aplicar('base')
}

async function cmdAjustar(instrucao: string): Promise<void> {
  if (!instrucao) throw new Error('Uso: ajustar <instrução>')

  if (!rig) {
    // `ajustar` mexe na cena carregada — sem rig não há o que ajustar. Como
    // o erro sozinho não diz COMO carregar, listamos o que já está em cache.
    const entries = library.listDetailed()
    let msg = '`ajustar` mexe na cena carregada — carregue uma rig primeiro.'
    if (entries.length > 0) {
      msg += '\n\nRigs em cache (carregam sem gastar token):\n'
      msg += entries.map((e) => `  rig ${e.slug}\n      ${e.musica} / ${e.artista}`).join('\n')
      msg += '\n\nOu gere uma nova: rig <música>'
    } else {
      msg += '\n\nNenhuma rig em cache ainda. Gere uma: rig <música>'
    }
    throw new Error(msg)
  }

  if (!cenaAtual) throw new Error('Nenhuma cena aplicada ainda. Use `cena <nome>`.')

  const scope = checkScope(instrucao, 'ajuste')
  if (!scope.inScope) {
    console.log(chalk.red(`Fora de escopo: ${scope.reason}.`))
    return
  }

  const cenaBase = rig.cenas[cenaAtual]
  if (!cenaBase) throw new Error(`Cena '${cenaAtual}' não existe mais na rig carregada.`)

  const { chosen } = await resolveProvider()
  console.log(chalk.dim(`Consultando ${chosen.label} (${chosen.model()})...`))

  const spec = exigir(rig.plugin)
  const { resumo, cena } = await ajustarCena(spec, cenaBase.params, rig.amp, instrucao, systemPrompt)
  // Só os parâmetros mudam — título, explicação e ajustes de guitarra continuam
  // descrevendo a mesma cena.
  rig.cenas[cenaAtual] = { ...cenaBase, params: cena }

  const started = performance.now()
  const { amp, ampInstruction, warning, ccsSent } = midi.applyScene(spec, cena, rig.amp, strategy)
  const ms = performance.now() - started

  console.log(
    chalk.green(`Cena '${cenaAtual}' ajustada`) +
      chalk.dim(` — amp ${amp}, ${ccsSent} CCs em ${ms.toFixed(1)}ms`),
  )
  console.log(chalk.dim(`  ${resumo}`))
  if (warning) console.log(chalk.yellow(`  ! ${warning}`))
  if (ampInstruction) console.log(chalk.yellow(`  ! ${ampInstruction}`))

  if (slugAtual) {
    const file = library.save(slugAtual, rig)
    console.log(chalk.dim(`Salvo em ${file}`))
  }
}

async function handle(line: string): Promise<boolean> {
  const trimmed = line.trim()
  const space = trimmed.indexOf(' ')
  const cmd = (space === -1 ? trimmed : trimmed.slice(0, space)).toLowerCase()
  const rest = space === -1 ? '' : trimmed.slice(space + 1).trim()
  const args = rest.split(/\s+/).filter(Boolean)

  switch (cmd) {
    case '':
      return true

    case 'rig':
      await cmdRig(rest)
      return true

    case 'regerar':
      await cmdRig(rest, true)
      return true

    case 'cena':
      if (!rest) throw new Error('Uso: cena <nome>')
      aplicar(rest)
      return true

    case 'ajustar':
      await cmdAjustar(rest)
      return true

    case 'show':
      if (!rig) throw new Error('Nenhuma rig carregada.')
      showRig(rig, cenaAtual)
      return true

    case 'rigs': {
      const entries = library.listDetailed()
      if (entries.length === 0) {
        console.log(chalk.dim('Nenhuma rig em cache ainda. Gere uma: rig <música>'))
        return true
      }
      for (const e of entries) {
        const marca = e.slug === slugAtual ? chalk.green('->') : '  '
        console.log(`${marca} ${chalk.cyan(e.slug)}`)
        console.log(`     ${e.musica} ${chalk.dim(`/ ${e.artista}`)}  ${chalk.dim(`cenas: ${e.cenas.join(', ')}`)}`)
      }
      console.log(chalk.dim('\nCarregue com: rig <slug>  (não gasta token)'))
      return true
    }

    case 'learn':
      midi.startLearn(parseCC(args[0]))
      console.log(chalk.green(`Pulsando CC ${args[0]}.`) + chalk.dim(' `stop` interrompe.'))
      return true

    case 'stop':
      midi.stopLearn()
      console.log(chalk.dim('Learn interrompido.'))
      return true

    case 'sweep':
      await midi.sweep(parseCC(args[0]))
      console.log(chalk.dim('Sweep concluído.'))
      return true

    case 'set': {
      const cc = parseCC(args[0])
      const value = Number(args[1])
      if (!Number.isInteger(value) || value < 0 || value > 127) {
        throw new Error(`Valor inválido: '${args[1] ?? ''}' (esperado inteiro 0–127)`)
      }
      midi.sendCC(cc, value)
      console.log(chalk.dim(`CC ${cc} = ${value}`))
      return true
    }

    case 'amptest':
      for (const value of [0, 32, 64, 96, 127]) {
        console.log(`  CC ${plugin.ampSelect.cc} = ${chalk.yellow(String(value))}`)
        midi.sendCC(plugin.ampSelect.cc, value)
        await midi.sleep(2000)
      }
      strategy.reset()
      console.log(chalk.dim('amptest concluído.'))
      return true

    case 'provider': {
      console.log(chalk.dim('Verificando as chaves...'))
      const { chosen, checks } = await resolveProvider(true)
      const checked = new Set(checks.map((c) => c.provider.id))

      for (const { provider, keyPresent } of knownProviders()) {
        const check = checks.find((c) => c.provider.id === provider.id)
        const status = !checked.has(provider.id)
          ? chalk.dim(keyPresent ? 'chave presente, não testada' : 'sem chave')
          : check!.validation.ok
            ? chalk.green(check!.validation.detail)
            : chalk.red(check!.validation.detail)
        const mark = provider.id === chosen.id ? chalk.green('->') : '  '
        console.log(`${mark} ${provider.label.padEnd(10)} ${status}`)
      }
      console.log(chalk.dim(`\nEm uso: ${chosen.label} / ${chosen.model()}\n`))
      return true
    }

    case 'reload':
      systemPrompt = loadSystemPrompt()
      console.log(chalk.green('System prompt recarregado do disco.'))
      return true

    case 'trace': {
      if (rest) {
        setTraceMode(rest)
        if (getTraceMode() !== 'off') console.log(chalk.dim(`Log completo em ${LOG_FILE}`))
      }
      console.log(
        `Trace: ${chalk.yellow(getTraceMode())} ` +
          chalk.dim(`(${TRACE_MODES.join(' | ')})`) +
          chalk.dim('\n  on   = system prompt, mensagens, resposta, tokens, validação') +
          chalk.dim('\n  full = o mesmo + JSON Schema da tool e resposta crua da API'),
      )
      return true
    }

    case 'prompt':
      console.log(chalk.dim(`\n--- system prompt (${systemPrompt.length} chars) ---`))
      console.log(systemPrompt)
      console.log(chalk.dim('--- fim ---\n'))
      return true

    case 'schema': {
      const schema = rigJsonSchema(plugin)
      console.log(chalk.dim(`\n--- input_schema da tool '${toolName(plugin)}' ---`))
      console.log(JSON.stringify(schema, null, 2))
      console.log(chalk.dim('--- fim ---\n'))
      return true
    }

    case 'help':
      console.log(HELP)
      return true

    case 'quit':
    case 'exit':
      return false

    default:
      console.log(chalk.red(`Comando desconhecido: '${cmd}'. Digite \`help\`.`))
      return true
  }
}

async function main(): Promise<void> {
  const port = midi.openPort()
  console.log(chalk.green(`Porta MIDI aberta: '${port}'`))
  console.log(chalk.dim(`Estratégia de amp: ${strategy.name}`))

  // Só presença aqui — validar custa uma ida à rede e nem todo uso do REPL
  // (learn, sweep, amptest) precisa de IA. A validação roda no primeiro `rig`.
  const keys = knownProviders()
    .map(({ provider, keyPresent }) =>
      keyPresent ? chalk.green(provider.keyEnv) : chalk.dim(provider.keyEnv),
    )
    .join('  ')
  console.log(chalk.dim('Chaves de IA: ') + keys + chalk.dim('  (`provider` valida)'))

  const traceMode = getTraceMode()
  console.log(
    chalk.dim('Trace da IA: ') +
      (traceMode === 'off' ? chalk.dim('off') : chalk.yellow(traceMode)) +
      chalk.dim('  (`trace on` mostra o que vai e volta)'),
  )

  const mapped = ampsMapeados(plugin)
  console.log(
    chalk.dim(`Plugin: `) + chalk.green(plugin.nome),
  )
  console.log(
    chalk.dim('Amps com knobs mapeados: ') +
      (mapped.length ? chalk.green(mapped.join(', ')) : chalk.red('nenhum')) +
      chalk.dim(` (de ${plugin.amps.length})`),
  )
  console.log(HELP)

  const rl = readline.createInterface({ input, output })
  rl.on('close', () => {
    midi.close()
    process.exit(0)
  })

  process.on('SIGINT', () => {
    midi.close()
    rl.close()
  })

  for (;;) {
    const line = await rl.question(chalk.bold('rig> '))
    try {
      if (!(await handle(line))) break
    } catch (err) {
      console.log(chalk.red(err instanceof Error ? err.message : String(err)))
    }
  }

  rl.close()
}

main().catch((err) => {
  console.error(chalk.red(err instanceof Error ? err.message : String(err)))
  midi.close()
  process.exit(1)
})

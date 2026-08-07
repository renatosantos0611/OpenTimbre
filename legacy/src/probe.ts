/**
 * FASE 0 — sonda de capacidade. Entrypoint independente (`npm run probe`).
 *
 * Não depende de nada de IA: só abre a porta e manda CC, para descobrir o que
 * o plugin realmente aceita. O resultado vira o `capabilities.md`.
 */

import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import chalk from 'chalk'
import * as midi from './midi-out.js'
import { exigir, padrao } from './plugins/index.js'

// A sonda opera sobre um plugin de cada vez. Sem PLUGIN, cai no primeiro do
// catálogo (hoje o Gojira, já confirmado); `PLUGIN=soldano npm run probe`
// mira a sonda no plugin ainda não confirmado.
const plugin = process.env['PLUGIN'] ? exigir(process.env['PLUGIN']) : padrao()

const AMPS = plugin.amps
const AMP_CC = plugin.ampCC
const AMP_PARAMS = plugin.ampParams
const AMP_PARAM_NAMES = Object.keys(AMP_PARAMS)
const AMP_SELECT_CC = plugin.ampSelect.cc
const PARAMS = plugin.params
const PARAM_NAMES = Object.keys(PARAMS)

const HELP = `
${chalk.bold('Comandos')}
  ${chalk.cyan('ports')}              lista as portas MIDI de saída visíveis
  ${chalk.cyan('learn <cc>')}         pulsa o CC (127/0 a cada 500ms) para o MIDI Learn capturar
  ${chalk.cyan('stop')}               interrompe o modo learn
  ${chalk.cyan('sweep <cc>')}         varre o CC de 0 a 127 lentamente
  ${chalk.cyan('set <cc> <valor>')}   manda um valor pontual (0–127)
  ${chalk.cyan('amptest')}            manda CC ${AMP_SELECT_CC} no valor de cada amp (${AMPS.length}), 2s entre cada
  ${chalk.cyan('map')}                imprime o mapa de CC de referência
  ${chalk.cyan('help')}               esta ajuda
  ${chalk.cyan('quit')}               sai
`

function printMap(): void {
  console.log(chalk.bold(`\n  ${plugin.nome}`))
  console.log(chalk.bold('  CC   parâmetro        tipo'))
  console.log(
    `  ${String(AMP_SELECT_CC).padEnd(4)} ${'ampSelect'.padEnd(16)} seletor ${AMPS.length} posições`,
  )

  // Os parâmetros do amp têm um CC por amplificador — cada amp tem seu próprio
  // conjunto no plugin, com nomes diferentes inclusive.
  for (const amp of AMPS) {
    const ccs = AMP_CC[amp] ?? {}
    const entries = AMP_PARAM_NAMES.filter((k) => ccs[k] !== undefined)
    if (entries.length === 0) {
      console.log(chalk.dim(`  --   amp ${amp}: não mapeado`))
      continue
    }
    for (const name of entries) {
      const label = `${amp}.${name}`.padEnd(16)
      console.log(`  ${String(ccs[name]).padEnd(4)} ${label} ${AMP_PARAMS[name]!.type}`)
    }
  }

  for (const name of PARAM_NAMES) {
    const spec = PARAMS[name]!
    console.log(`  ${String(spec.cc).padEnd(4)} ${name.padEnd(16)} ${spec.type}`)
  }
  console.log()
}

function parseCC(arg: string | undefined): number {
  const cc = Number(arg)
  if (!Number.isInteger(cc) || cc < 0 || cc > 127) {
    throw new Error(`CC inválido: '${arg ?? ''}' (esperado inteiro 0–127)`)
  }
  return cc
}

async function amptest(): Promise<void> {
  // MIDI é via única: a app manda e nunca recebe nada de volta. Quem lê o
  // resultado é o usuário, olhando para o plugin — daí o aviso explícito.
  //
  // Os valores testados são os de `ampSelect.valores` do próprio plugin — não
  // uma lista fixa. Isso importa porque nem todo plugin tem um seletor de 3
  // posições feito para o meio da faixa (Gojira): o Soldano é um toggle de 2
  // (NORMAL/OVERDRIVE), e testar 5 valores arbitrários seria redundante e
  // confuso ("qual amp aparece em 32 e em 0, se os dois já são o mesmo?").
  console.log(
    chalk.yellow('Olhe para o PLUGIN, não para este terminal.') +
      chalk.dim(' Confirme se o amp que aparece bate com o esperado.'),
  )
  console.log(
    chalk.dim(`Se nada mudar, o CC ${AMP_SELECT_CC} ainda não está mapeado no MIDI Mappings.\n`),
  )

  for (const [amp, value] of Object.entries(plugin.ampSelect.valores)) {
    console.log(
      `  CC ${AMP_SELECT_CC} = ${chalk.yellow(String(value).padStart(3))}  → esperado: ${chalk.bold(amp)}`,
    )
    midi.sendCC(AMP_SELECT_CC, value)
    await midi.sleep(2000)
  }

  console.log(chalk.dim('\namptest concluído. Registre o resultado em capabilities.md.'))
}

async function handle(line: string): Promise<boolean> {
  const [cmd = '', ...args] = line.trim().split(/\s+/)

  switch (cmd.toLowerCase()) {
    case '':
      return true

    case 'ports': {
      const ports = midi.listPorts()
      if (ports.length === 0) console.log(chalk.red('Nenhuma porta de saída encontrada.'))
      else ports.forEach((p, i) => console.log(`  [${i}] ${p}`))
      return true
    }

    case 'learn': {
      const cc = parseCC(args[0])
      midi.startLearn(cc)
      console.log(
        chalk.green(`Pulsando CC ${cc}.`) +
          chalk.dim(' Faça o MIDI Learn no plugin e depois digite `stop`.'),
      )
      return true
    }

    case 'stop':
      midi.stopLearn()
      console.log(chalk.dim('Learn interrompido.'))
      return true

    case 'sweep': {
      const cc = parseCC(args[0])
      console.log(chalk.dim(`Varrendo CC ${cc} de 0 a 127...`))
      await midi.sweep(cc)
      console.log(chalk.dim('Sweep concluído.'))
      return true
    }

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
      await amptest()
      return true

    case 'map':
      printMap()
      return true

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
    const line = await rl.question(chalk.bold('probe> '))
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

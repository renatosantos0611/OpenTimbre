/**
 * Guardrail de escopo. Roda ANTES da chamada de API — heurística de palavras
 * para barrar pedido claramente fora de assunto sem gastar token. Não precisa
 * ser à prova de balas: o system prompt também instrui o modelo a recusar.
 *
 * Há dois modos, porque `rig` e `ajustar` recebem textos de natureza diferente:
 * um título de música ("november rain") e uma instrução de timbre ("deixe mais
 * escuro e encorpado"). A heurística que serve para um atrapalha o outro.
 */

const KEYWORDS = [
  'música', 'musica', 'song', 'banda', 'artista', 'álbum', 'album', 'disco', 'faixa',
  'tom', 'timbre', 'som', 'tone', 'rig', 'preset', 'patch',
  'amp', 'amplificador', 'valvulado', 'marshall', 'fender', 'mesa', 'orange', 'vox',
  'guitarra', 'guitar', 'baixo', 'captador', 'humbucker', 'single coil', 'strat', 'les paul',
  'pedal', 'overdrive', 'drive', 'boost', 'distorção', 'distorcao', 'fuzz', 'ganho', 'gain',
  'delay', 'reverb', 'chorus', 'phaser', 'octaver', 'wah', 'modulação', 'modulacao',
  'riff', 'solo', 'intro', 'ponte', 'refrão', 'refrao', 'verso', 'limpo', 'clean', 'crunch',
  'metal', 'rock', 'blues', 'jazz', 'punk', 'grunge', 'hardcore', 'thrash', 'stoner',
  'equalização', 'equalizacao', 'eq', 'grave', 'médio', 'medio', 'agudo', 'palm mute',
  'afinação', 'afinacao', 'drop', 'acorde', 'escala', 'cena',
  // vocabulário de ajuste de timbre — o que aparece num `ajustar`
  'brilho', 'corpo', 'peso', 'presença', 'presenca', 'volume', 'saturação', 'saturacao',
  'compressão', 'compressao', 'ataque', 'sustain', 'escuro', 'claro', 'sujo', 'seco',
  'encorpado', 'aberto', 'fechado', 'apertado', 'quente', 'frio', 'agressivo', 'suave',
]

export type ScopeMode = 'titulo' | 'ajuste'

export type ScopeResult = { inScope: true } | { inScope: false; reason: string }

export function checkScope(pedido: string, mode: ScopeMode = 'titulo'): ScopeResult {
  const text = pedido.toLowerCase()

  if (text.trim().length < 3) {
    return { inScope: false, reason: 'pedido vazio ou curto demais' }
  }

  if (KEYWORDS.some((k) => text.includes(k))) {
    return { inScope: true }
  }

  // No `ajustar` o contexto já está estabelecido: há uma rig carregada e o
  // usuário digitou o comando de ajuste. Barrar uma instrução legítima de
  // timbre só porque ela é longa e não usou uma palavra da lista custa mais
  // do que a chamada de API que se economizaria.
  if (mode === 'ajuste') {
    return { inScope: true }
  }

  // Título de música raramente traz palavra-chave técnica — aceitamos se
  // parecer um título (poucas palavras, sem pergunta sobre outro assunto).
  const words = text.trim().split(/\s+/)
  if (words.length <= 8 && !/[?]/.test(text)) {
    return { inScope: true }
  }

  return {
    inScope: false,
    reason: 'não parece um pedido sobre música, tom de guitarra ou equipamento',
  }
}

import * as THREE from 'three'
import type { LedgerCard } from '@/lib/vault-ui'

/** Render actual ledger values into the original 3D tiles, in place of project-image atlases. */
export function ledgerTexture(card: LedgerCard) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 768
  const ctx = canvas.getContext('2d')!
  const accent =
    card.tone === 'red'
      ? '#ff8d83'
      : card.tone === 'amber'
        ? '#e8c077'
        : '#1eff66'
  ctx.fillStyle = '#050705'
  ctx.fillRect(0, 0, 768, 768)
  ctx.strokeStyle = '#233027'
  ctx.strokeRect(1, 1, 766, 766)
  ctx.fillStyle = '#8f9c93'
  ctx.font = '18px "DM Mono", monospace'
  ctx.fillText(card.category, 44, 58)
  ctx.fillStyle = '#f5f5f2'
  ctx.font = '38px Arial'
  ctx.fillText(card.title, 44, 143)
  let size = 106
  ctx.font = `${size}px "DM Mono", monospace`
  while (ctx.measureText(card.value).width > 674 && size > 36)
    ctx.font = `${--size}px "DM Mono", monospace`
  ctx.fillStyle = accent
  ctx.fillText(card.value, 40, 285)
  ctx.fillStyle = '#b0bab2'
  ctx.font = '21px Arial'
  const words = card.subtitle.split(' ')
  let line = '',
    y = 340
  for (const word of words) {
    if (ctx.measureText(line + word).width > 660) {
      ctx.fillText(line, 44, y)
      line = ''
      y += 29
    }
    line += word + ' '
  }
  ctx.fillText(line, 44, y)
  if (card.meter !== undefined) {
    ctx.fillStyle = '#1c2b21'
    ctx.fillRect(44, 405, 680, 8)
    ctx.fillStyle = accent
    ctx.fillRect(44, 405, 680 * Math.max(0, Math.min(1, card.meter)), 8)
  }
  if (card.phaseIndex !== undefined && card.phaseIndex >= 0) {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i === card.phaseIndex ? accent : '#233027'
      ctx.fillRect(44 + i * 230, 405, 215, 8)
    }
  }
  card.lines.slice(0, 3).forEach(([label, value], i) => {
    const y = 490 + i * 72
    ctx.strokeStyle = '#233027'
    ctx.beginPath()
    ctx.moveTo(44, y - 28)
    ctx.lineTo(724, y - 28)
    ctx.stroke()
    ctx.fillStyle = '#8f9c93'
    ctx.font = '18px "DM Mono", monospace'
    ctx.fillText(label, 44, y + 9)
    ctx.fillStyle = '#eef3ee'
    ctx.textAlign = 'right'
    ctx.font = '19px "DM Mono", monospace'
    let rendered = value
    while (ctx.measureText(rendered).width > 355)
      rendered = rendered.slice(0, -2) + '…'
    ctx.fillText(rendered, 724, y + 9)
    ctx.textAlign = 'left'
  })
  ctx.fillStyle = '#79877d'
  ctx.font = '15px "DM Mono", monospace'
  ctx.fillText('PATAPIM / XRPL DEVNET', 44, 721)
  ctx.fillStyle = accent
  ctx.textAlign = 'right'
  ctx.fillText('OPEN DETAILS', 724, 721)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  return texture
}

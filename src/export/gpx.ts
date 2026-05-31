// 走行履歴 1 件を GPX 1.1 XML に変換する（純関数）。
// - trackpoints があれば trkpt 付きの track を出力（Strava 等で地図表示可能）
// - 古い v0.4.0 データ（trackpoints 無し）は metadata + 空 trkseg の「サマリのみ GPX」
// - 副作用なし。ダウンロード（Blob 生成）は呼び出し側（main.ts）が行う
//
// プライバシー: trackpoint は端末内のみに保存され、本関数も文字列を返すだけ。
// 外部送信は旦那様が書き出し後に手動でアップロードした時に初めて発生する。

import type { RunHistoryEntry } from '../storage/types'
import { formatDistance, formatPace, formatTime } from '../run/format'

const GPX_CREATOR = 'G2 Run HUD'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function isoTime(ms: number): string {
  return new Date(ms).toISOString()
}

/** 履歴 1 件の概要（GPX desc 用）。例: 距離 3.24 km / 時間 28:40 / 平均ペース 5'10"/km / RUN */
function summaryLine(entry: RunHistoryEntry): string {
  const dist = `${formatDistance(entry.distanceM)} km`
  const time = formatTime(entry.elapsedMs)
  const pace = `${formatPace(entry.averagePaceSecPerKm)}/km`
  const mode = entry.mode === 'walk' ? 'WALK' : 'RUN'
  return `距離 ${dist} / 時間 ${time} / 平均ペース ${pace} / ${mode}`
}

/** 履歴エントリ用の GPX ファイル名。例: g2run-20260531-0923.gpx */
export function gpxFileName(entry: RunHistoryEntry): string {
  const d = new Date(entry.startedAt)
  const p = (n: number): string => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
  return `g2run-${stamp}.gpx`
}

/** 走行履歴 1 件を GPX 1.1 XML 文字列に変換する。 */
export function runHistoryEntryToGpx(entry: RunHistoryEntry): string {
  const name = `${GPX_CREATOR} ${entry.mode === 'walk' ? 'WALK' : 'RUN'} ${isoTime(entry.startedAt).slice(0, 10)}`
  const type = entry.mode === 'walk' ? 'walking' : 'running'
  const trackpoints = entry.trackpoints ?? []

  const trkpts = trackpoints
    .map((tp) => {
      const lines = [`        <trkpt lat="${tp.lat}" lon="${tp.lon}">`]
      if (tp.ele !== undefined && Number.isFinite(tp.ele)) lines.push(`          <ele>${tp.ele}</ele>`)
      lines.push(`          <time>${isoTime(tp.t)}</time>`)
      lines.push('        </trkpt>')
      return lines.join('\n')
    })
    .join('\n')

  // trkpt が無い古いデータは空 trkseg（GPX 的には valid・地図表示はされないがサマリは残る）
  const trksegInner = trkpts.length > 0 ? `\n${trkpts}\n      ` : ''

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx version="1.1" creator="${escapeXml(GPX_CREATOR)}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`,
    '  <metadata>',
    `    <name>${escapeXml(name)}</name>`,
    `    <desc>${escapeXml(summaryLine(entry))}</desc>`,
    `    <time>${isoTime(entry.startedAt)}</time>`,
    '  </metadata>',
    '  <trk>',
    `    <name>${escapeXml(name)}</name>`,
    `    <type>${type}</type>`,
    `    <trkseg>${trksegInner}</trkseg>`,
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n')
}

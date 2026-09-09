import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { REFERENCE } from '../lib/bp'
import { formatFull, formatShort, parseISO, shiftISO, todayISO } from '../lib/dates'
import { t } from '../lib/strings'
import type { Reading, TimeOfDay } from '../lib/types'

type Range = 'd30' | 'd90' | 'y1' | 'all'
type Filter = 'all' | 'morning' | 'evening'

const RANGE_DAYS: Record<Range, number | null> = { d30: 30, d90: 90, y1: 365, all: null }

/**
 * Places a point at a plausible hour within its day, so a morning and an evening
 * reading on the same date are two distinct points on a time axis instead of
 * collapsing onto each other.
 */
const HOUR_OF: Record<TimeOfDay, number> = { morning: 8, other: 13, evening: 20 }

interface Point {
  x: number
  systolic: number
  diastolic: number
  pulse: number | null
  note: string | null
  measured_on: string
  time_of_day: TimeOfDay
}

const css = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

export default function GraphTab({ readings }: { readings: Reading[] }) {
  const [range, setRange] = useState<Range>('d90')
  const [filter, setFilter] = useState<Filter>('all')
  const [showPulse, setShowPulse] = useState(false)
  const [showTable, setShowTable] = useState(false)

  const points = useMemo<Point[]>(() => {
    const days = RANGE_DAYS[range]
    const from = days === null ? null : shiftISO(todayISO(), -days)

    return readings
      .filter((r) => (from === null || r.measured_on >= from))
      .filter((r) => filter === 'all' || r.time_of_day === filter)
      .map((r) => {
        const d = parseISO(r.measured_on)
        d.setHours(HOUR_OF[r.time_of_day])
        return {
          x: d.getTime(),
          systolic: r.systolic,
          diastolic: r.diastolic,
          pulse: r.pulse,
          note: r.note,
          measured_on: r.measured_on,
          time_of_day: r.time_of_day,
        }
      })
      .sort((a, b) => a.x - b.x)
  }, [readings, range, filter])

  const stats = useMemo(() => {
    if (points.length === 0) return null
    const mean = (nums: number[]) => Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
    return {
      systolic: mean(points.map((p) => p.systolic)),
      diastolic: mean(points.map((p) => p.diastolic)),
      count: points.length,
    }
  }, [points])

  const pulsePoints = useMemo(() => points.filter((p) => p.pulse !== null), [points])

  // Past roughly 40 points the per-reading dots merge into a bead-chain and hide
  // the trend; the hover cursor still exposes individual readings.
  const showDots = points.length <= 40

  const colors = {
    systolic: css('--series-systolic', '#b3243b'),
    diastolic: css('--series-diastolic', '#1f6fb2'),
    pulse: css('--series-pulse', '#6b7280'),
    grid: css('--grid', '#e6e9ed'),
    dim: css('--text-dim', '#5f6772'),
    surface: css('--surface', '#ffffff'),
  }

  const tickFormatter = (v: number) => formatShort(isoOf(v))

  return (
    <div className="card">
      <h2>{t.graph.title}</h2>

      <div className="toolbar">
        <div className="segmented">
          {(Object.keys(RANGE_DAYS) as Range[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={range === key}
              onClick={() => setRange(key)}
            >
              {t.graph.ranges[key]}
            </button>
          ))}
        </div>

        <div className="segmented">
          {(['all', 'morning', 'evening'] as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {t.graph.filters[key]}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="summary">
          <div className="stat">
            <div className="k">{t.graph.avgSystolic}</div>
            <div className="v ltr">{stats.systolic}</div>
          </div>
          <div className="stat">
            <div className="k">{t.graph.avgDiastolic}</div>
            <div className="v ltr">{stats.diastolic}</div>
          </div>
          <div className="stat">
            <div className="k">{t.graph.count}</div>
            <div className="v ltr">{stats.count}</div>
          </div>
        </div>
      )}

      {points.length === 0 ? (
        <p className="empty">{t.graph.empty}</p>
      ) : (
        <>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 10, right: 6, bottom: 4, left: 6 }}>
                <CartesianGrid stroke={colors.grid} vertical={false} />
                <XAxis
                  dataKey="x"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={tickFormatter}
                  tickMargin={8}
                  minTickGap={28}
                  padding={{ left: 10, right: 10 }}
                  stroke={colors.grid}
                />
                <YAxis
                  orientation="right"
                  domain={[40, 'auto']}
                  width={46}
                  tickMargin={6}
                  stroke={colors.grid}
                />

                <ReferenceLine
                  y={REFERENCE.highSystolic}
                  stroke={colors.dim}
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                />
                <ReferenceLine
                  y={REFERENCE.highDiastolic}
                  stroke={colors.dim}
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                />
                <ReferenceLine y={REFERENCE.normalSystolic} stroke={colors.grid} />
                <ReferenceLine y={REFERENCE.normalDiastolic} stroke={colors.grid} />

                <Tooltip content={<ReadingTooltip />} cursor={{ stroke: colors.dim, strokeWidth: 1 }} />
                <Legend verticalAlign="bottom" height={28} />

                <Line
                  type="monotone"
                  dataKey="systolic"
                  name={t.graph.series.systolic}
                  stroke={colors.systolic}
                  strokeWidth={2}
                  dot={showDots ? { r: 4, strokeWidth: 2, stroke: colors.surface } : false}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="diastolic"
                  name={t.graph.series.diastolic}
                  stroke={colors.diastolic}
                  strokeWidth={2}
                  dot={showDots ? { r: 4, strokeWidth: 2, stroke: colors.surface } : false}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={showPulse}
              onChange={(e) => setShowPulse(e.target.checked)}
            />
            {t.graph.showPulse}
          </label>

          {/* Pulse is bpm, not mmHg, so it gets its own panel sharing the x axis
              rather than a second y-scale on the chart above. */}
          {showPulse && pulsePoints.length > 0 && (
            <div className="chart-wrap" style={{ height: 160, marginBlockStart: 12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pulsePoints} margin={{ top: 10, right: 6, bottom: 4, left: 6 }}>
                  <CartesianGrid stroke={colors.grid} vertical={false} />
                  <XAxis
                    dataKey="x"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={tickFormatter}
                    tickMargin={8}
                    minTickGap={28}
                    padding={{ left: 10, right: 10 }}
                    stroke={colors.grid}
                  />
                  <YAxis orientation="right" domain={['auto', 'auto']} width={46} stroke={colors.grid} />
                  <Tooltip content={<ReadingTooltip pulseOnly />} />
                  <Legend verticalAlign="bottom" height={28} />
                  <Line
                    type="monotone"
                    dataKey="pulse"
                    name={t.graph.series.pulse}
                    stroke={colors.pulse}
                    strokeWidth={2}
                    dot={showDots ? { r: 4, strokeWidth: 2, stroke: colors.surface } : false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <button
            className="btn link"
            type="button"
            style={{ marginBlockStart: 8 }}
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? t.graph.hideTable : t.graph.showTable}
          </button>

          {showTable && <ReadingTable points={points} />}
        </>
      )}
    </div>
  )
}

const isoOf = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface TooltipProps {
  active?: boolean
  payload?: { payload: Point }[]
  pulseOnly?: boolean
}

function ReadingTooltip({ active, payload, pulseOnly }: TooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 13,
        boxShadow: 'var(--shadow)',
        color: 'var(--text)',
      }}
    >
      <div style={{ fontWeight: 600 }}>
        <span className="ltr">{formatFull(p.measured_on)}</span>
        <span style={{ color: 'var(--text-dim)' }}> · {t.timeOfDay[p.time_of_day]}</span>
      </div>
      {!pulseOnly && (
        <div className="ltr" style={{ marginBlockStart: 4 }}>
          {p.systolic}/{p.diastolic} <span style={{ color: 'var(--text-dim)' }}>mmHg</span>
        </div>
      )}
      {p.pulse !== null && (
        <div className="ltr">
          {p.pulse} <span style={{ color: 'var(--text-dim)' }}>bpm</span>
        </div>
      )}
      {p.note && <div style={{ color: 'var(--text-dim)', marginBlockStart: 4 }}>{p.note}</div>}
    </div>
  )
}

function ReadingTable({ points }: { points: Point[] }) {
  return (
    <div style={{ overflowX: 'auto', marginBlockStart: 10 }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>{t.entry.date}</th>
            <th>{t.graph.series.systolic}</th>
            <th>{t.graph.series.diastolic}</th>
            <th>{t.graph.series.pulse}</th>
            <th>{t.entry.timeOfDay}</th>
          </tr>
        </thead>
        <tbody>
          {[...points].reverse().map((p) => (
            <tr key={`${p.x}-${p.systolic}`}>
              <td className="ltr">{formatShort(p.measured_on)}</td>
              <td className="ltr">{p.systolic}</td>
              <td className="ltr">{p.diastolic}</td>
              <td className="ltr">{p.pulse ?? '—'}</td>
              <td>{t.timeOfDay[p.time_of_day]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

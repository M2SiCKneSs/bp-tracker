import { categoryTone, classify } from '../lib/bp'
import { formatShort } from '../lib/dates'
import { t } from '../lib/strings'
import type { Reading } from '../lib/types'

interface Props {
  readings: Reading[]
  onEdit: (reading: Reading) => void
  onDelete: (reading: Reading) => void
}

const RECENT = 10

export default function HistoryList({ readings, onEdit, onDelete }: Props) {
  if (readings.length === 0) return <p className="empty">{t.history.empty}</p>

  // listReadings() returns oldest-first for the chart; the list wants newest-first.
  const recent = [...readings].reverse().slice(0, RECENT)

  return (
    <ul className="history">
      {recent.map((r) => {
        const tone = categoryTone(classify(r.systolic, r.diastolic))
        const meta = [
          r.pulse !== null ? `${r.pulse} ${t.entry.bpm}` : null,
          r.note ? r.note : null,
        ].filter(Boolean)

        return (
          <li key={r.id}>
            <div className="when">
              <div className="date ltr">{formatShort(r.measured_on)}</div>
              <div className="tod">{t.timeOfDay[r.time_of_day]}</div>
            </div>

            <div className="values">
              <span className={`bp ltr badge ${tone}`}>
                {r.systolic}/{r.diastolic}
              </span>
              {meta.length > 0 && <div className="meta">{meta.join(' · ')}</div>}
            </div>

            <div className="actions">
              <button className="btn link" type="button" onClick={() => onEdit(r)}>
                {t.history.edit}
              </button>
              <button className="btn link" type="button" onClick={() => onDelete(r)}>
                {t.history.delete}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

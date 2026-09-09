import { useState, type FormEvent } from 'react'
import { categoryLabel, categoryTone, classify } from '../lib/bp'
import { defaultTimeOfDay, todayISO } from '../lib/dates'
import { createReading, deleteReading, updateReading, validate } from '../lib/readings'
import { t } from '../lib/strings'
import type { Reading, TimeOfDay } from '../lib/types'
import HistoryList from './HistoryList'

interface Props {
  userId: string
  readings: Reading[]
  onChanged: () => Promise<void>
}

const TIMES: TimeOfDay[] = ['morning', 'evening', 'other']

const blank = () => ({
  measured_on: todayISO(),
  time_of_day: defaultTimeOfDay(),
  systolic: '',
  diastolic: '',
  pulse: '',
  note: '',
})

/** Empty string maps to null so an untouched optional field stays NULL, not 0. */
const num = (v: string) => (v.trim() === '' ? null : Number(v))

export default function EntryTab({ userId, readings, onChanged }: Props) {
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<Reading | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Reading | null>(null)

  // Loading the row into the form is a direct consequence of the tap, so it
  // happens in the handler rather than in an effect watching `editing`.
  function startEdit(reading: Reading) {
    setEditing(reading)
    setSaved(null)
    setError(null)
    setForm({
      measured_on: reading.measured_on,
      time_of_day: reading.time_of_day,
      systolic: String(reading.systolic),
      diastolic: String(reading.diastolic),
      pulse: reading.pulse === null ? '' : String(reading.pulse),
      note: reading.note ?? '',
    })
  }

  function reset() {
    setForm(blank())
    setEditing(null)
    setError(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaved(null)

    const payload = {
      measured_on: form.measured_on,
      time_of_day: form.time_of_day,
      systolic: num(form.systolic),
      diastolic: num(form.diastolic),
      pulse: num(form.pulse),
      note: form.note.trim() === '' ? null : form.note.trim(),
    }

    const problem = validate(payload)
    if (problem) {
      setError(problem)
      return
    }

    setBusy(true)
    setError(null)
    try {
      const input = {
        ...payload,
        systolic: payload.systolic as number,
        diastolic: payload.diastolic as number,
      }
      const result = editing
        ? await updateReading(editing.id, input)
        : await createReading(userId, input)
      reset()
      setSaved(result)
      await onChanged()
    } catch {
      setError(t.common.error)
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(reading: Reading) {
    if (!window.confirm(t.history.confirmDelete)) return
    try {
      await deleteReading(reading.id)
      if (editing?.id === reading.id) reset()
      await onChanged()
    } catch {
      setError(t.common.error)
    }
  }

  const savedCategory = saved ? classify(saved.systolic, saved.diastolic) : null

  return (
    <>
      <form className="card" onSubmit={onSubmit}>
        <h2>{editing ? t.entry.editTitle : t.entry.title}</h2>

        {error && <div className="alert error">{error}</div>}
        {saved && savedCategory && (
          <div className="alert success">
            <span>{t.entry.saved} — </span>
            <span className={`badge ${categoryTone(savedCategory)}`}>
              {categoryLabel(savedCategory)}
            </span>
          </div>
        )}

        <div className="field">
          <label htmlFor="measured_on">{t.entry.date}</label>
          <input
            id="measured_on"
            type="date"
            dir="ltr"
            max={todayISO()}
            required
            value={form.measured_on}
            onChange={(e) => setForm({ ...form, measured_on: e.target.value })}
          />
        </div>

        <div className="pair">
          <div className="field">
            <label htmlFor="systolic">{t.entry.systolic}</label>
            <input
              id="systolic"
              type="number"
              inputMode="numeric"
              dir="ltr"
              placeholder="120"
              required
              value={form.systolic}
              onChange={(e) => setForm({ ...form, systolic: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="diastolic">{t.entry.diastolic}</label>
            <input
              id="diastolic"
              type="number"
              inputMode="numeric"
              dir="ltr"
              placeholder="80"
              required
              value={form.diastolic}
              onChange={(e) => setForm({ ...form, diastolic: e.target.value })}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="pulse">{t.entry.pulseOptional}</label>
          <input
            id="pulse"
            type="number"
            inputMode="numeric"
            dir="ltr"
            placeholder="70"
            value={form.pulse}
            onChange={(e) => setForm({ ...form, pulse: e.target.value })}
          />
        </div>

        <div className="field">
          <label>{t.entry.timeOfDay}</label>
          <div className="segmented">
            {TIMES.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={form.time_of_day === key}
                onClick={() => setForm({ ...form, time_of_day: key })}
              >
                {t.timeOfDay[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="note">{t.entry.note}</label>
          <input
            id="note"
            type="text"
            maxLength={200}
            placeholder={t.entry.notePlaceholder}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>

        <div className="btn-row">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? t.entry.saving : editing ? t.entry.saveEdit : t.entry.save}
          </button>
          {editing && (
            <button className="btn secondary" type="button" onClick={reset}>
              {t.entry.cancelEdit}
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <h2>{t.history.title}</h2>
        <HistoryList readings={readings} onEdit={startEdit} onDelete={onDelete} />
      </div>
    </>
  )
}

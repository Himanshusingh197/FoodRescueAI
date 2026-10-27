import { useState, useEffect } from 'react'
import { predictionAPI } from '../services/api'
import { extractError, formatDateShort } from '../utils/helpers'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ErrorBar,
} from 'recharts'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'all_day']
const FOOD_CATS = ['cooked_meals', 'bakery', 'dairy', 'fruits_vegetables', 'grains_cereals', 'snacks', 'other']

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export default function SurplusPrediction() {
  const [form, setForm] = useState({
    prediction_date: todayISO(),
    meal_type: 'lunch',
    expected_attendance: 200,
    meals_prepared: 240,
    food_category: 'cooked_meals',
    is_event_day: false,
    is_holiday: false,
  })
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [modelInfo, setModelInfo] = useState(null)

  useEffect(() => {
    predictionAPI.myPredictions()
      .then(r => setHistory(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
    predictionAPI.modelInfo()
      .then(r => setModelInfo(r.data.data))
      .catch(() => {})
  }, [])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await predictionAPI.predict({
        ...form,
        expected_attendance: parseInt(form.expected_attendance),
        meals_prepared: parseInt(form.meals_prepared),
      })
      const pred = res.data.data
      setResult(pred)
      setHistory(h => [pred, ...h].slice(0, 10))
      toast.success('Prediction generated')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  const confidenceColor = (c) => {
    if (c === 'high') return 'text-green-700 bg-green-100'
    if (c === 'medium') return 'text-yellow-700 bg-yellow-100'
    return 'text-red-700 bg-red-100'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Surplus Food Prediction</h1>
        <p className="text-gray-500 text-sm mt-1">Estimate how much food your kitchen may have left over today.</p>
      </div>

      {/* Model info banner */}
      {modelInfo && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-800">
            <strong>Model Note:</strong> {modelInfo.data_note || modelInfo.data_note}
            {modelInfo.rf_mae != null && ` Model MAE: ±${modelInfo.rf_mae} kg (vs baseline ±${modelInfo.baseline_mae} kg)`}
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Prediction Inputs</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input type="date" value={form.prediction_date} onChange={e => set('prediction_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Meal Type</label>
                <select value={form.meal_type} onChange={e => set('meal_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500">
                  {MEAL_TYPES.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Expected Attendance</label>
                <input type="number" min="1" value={form.expected_attendance} onChange={e => set('expected_attendance', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Meals Prepared</label>
                <input type="number" min="1" value={form.meals_prepared} onChange={e => set('meals_prepared', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Food Category</label>
                <select value={form.food_category} onChange={e => set('food_category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500">
                  {FOOD_CATS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase())}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.is_event_day} onChange={e => set('is_event_day', e.target.checked)}
                  className="accent-green-600" />
                Event Day
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.is_holiday} onChange={e => set('is_holiday', e.target.checked)}
                  className="accent-green-600" />
                Holiday
              </label>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {loading ? 'Predicting…' : '🔮 Predict Surplus'}
            </button>
          </form>
        </div>

        {/* Result */}
        {result ? (
          <div className="bg-white rounded-xl border border-green-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Prediction Result</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${confidenceColor(result.confidence_label)}`}>
                {result.confidence_label} confidence
              </span>
            </div>

            <div className="text-center py-4 bg-green-50 rounded-xl">
              <div className="text-4xl font-bold text-green-700">{result.predicted_surplus_kg} kg</div>
              <div className="text-sm text-gray-500 mt-1">
                Estimated range: {result.predicted_surplus_range_low}–{result.predicted_surplus_range_high} kg
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Key Factors</h4>
              <div className="space-y-2">
                {result.important_features?.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="text-xs text-gray-600 w-32 flex-shrink-0">{f.feature}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, f.importance * 400)}%` }} />
                    </div>
                    <div className="text-xs text-gray-500 w-12 text-right">{(f.importance * 100).toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-gray-400 border-t border-gray-100 pt-3">
              Model: {result.model_used} · {result.data_note?.slice(0, 100)}…
            </div>

            {result.predicted_surplus_kg > 2 && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                💡 You may have ~{result.predicted_surplus_kg} kg surplus.
                Consider <a href="/donor/create-donation" className="underline font-medium">listing it</a> for donation.
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col items-center justify-center text-center text-gray-400 gap-3 min-h-64">
            <div className="text-5xl">🔮</div>
            <p className="text-sm">Fill in the form and click Predict to see your estimated surplus.</p>
          </div>
        )}
      </div>

      {/* History */}
      {!loadingHistory && history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Predictions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Meal</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2">Predicted (kg)</th>
                  <th className="pb-2">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((p, i) => (
                  <tr key={p.id || i} className="text-gray-700">
                    <td className="py-2">{p.prediction_date}</td>
                    <td className="py-2 capitalize">{p.meal_type}</td>
                    <td className="py-2">{p.food_category?.replace(/_/g, ' ')}</td>
                    <td className="py-2 font-medium text-green-700">{p.predicted_surplus_kg}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        p.confidence_label === 'high' ? 'bg-green-100 text-green-700' :
                        p.confidence_label === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{p.confidence_label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { donationAPI } from '../services/api'
import { extractError } from '../utils/helpers'
import toast from 'react-hot-toast'

const CATEGORIES = [
  'cooked_meals', 'bakery', 'dairy', 'fruits_vegetables',
  'grains_cereals', 'beverages', 'packaged_food', 'snacks', 'other',
]
const STORAGE = ['room_temperature', 'refrigerated', 'frozen', 'hot']
const ALLERGENS = ['Gluten', 'Dairy', 'Eggs', 'Nuts', 'Peanuts', 'Soy', 'Shellfish', 'Fish']

function toLocalISO(date) {
  const d = new Date(date)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function CreateDonation() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState(null)

  const defaultDeadline = toLocalISO(Date.now() + 24 * 3600000)
  const defaultStart = toLocalISO(Date.now() + 3600000)

  const [form, setForm] = useState({
    food_name: '', food_category: 'cooked_meals', description: '',
    quantity: '', unit: 'kg', serves_people: '',
    storage_condition: 'room_temperature', storage_notes: '',
    allergens: [],
    pickup_address: '', pickup_city: '',
    pickup_latitude: '', pickup_longitude: '',
    pickup_instructions: '',
    collection_start_time: defaultStart,
    pickup_deadline: defaultDeadline,
    is_vegetarian: false, is_vegan: false, is_halal: false, is_kosher: false,
    donor_confirms_accuracy: false,
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const toggleAllergen = (a) => {
    setForm(p => ({
      ...p,
      allergens: p.allergens.includes(a) ? p.allergens.filter(x => x !== a) : [...p.allergens, a],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.donor_confirms_accuracy) {
      toast.error('Please confirm the accuracy of food information')
      return
    }
    if (!form.pickup_latitude || !form.pickup_longitude) {
      toast.error('Please enter pickup location coordinates')
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...form,
        quantity: parseFloat(form.quantity),
        serves_people: form.serves_people ? parseInt(form.serves_people) : null,
        pickup_latitude: parseFloat(form.pickup_latitude),
        pickup_longitude: parseFloat(form.pickup_longitude),
        collection_start_time: new Date(form.collection_start_time).toISOString(),
        pickup_deadline: new Date(form.pickup_deadline).toISOString(),
      }
      const res = await donationAPI.create(payload)
      const donationId = res.data.data.id

      if (imageFile) {
        try {
          await donationAPI.uploadImage(donationId, imageFile)
        } catch {
          toast('Donation created but image upload failed.', { icon: '⚠️' })
        }
      }

      toast.success('Donation listed successfully!')
      navigate(`/donations/${donationId}`)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">List Surplus Food</h1>
        <p className="text-gray-500 text-sm mt-1">Fill in accurate details — recipients rely on this information.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Food info */}
        <Section title="Food Information">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Food Name *</Label>
              <Input required value={form.food_name} onChange={e => set('food_name', e.target.value)} placeholder="e.g. Dal Rice, Bread Loaves" />
            </div>
            <div>
              <Label>Category *</Label>
              <Select required value={form.food_category} onChange={e => set('food_category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase())}</option>)}
              </Select>
            </div>
            <div>
              <Label>Storage Condition *</Label>
              <Select required value={form.storage_condition} onChange={e => set('storage_condition', e.target.value)}>
                {STORAGE.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase())}</option>)}
              </Select>
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input required type="number" min="0.1" step="0.1" value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="10" />
            </div>
            <div>
              <Label>Unit *</Label>
              <Select required value={form.unit} onChange={e => set('unit', e.target.value)}>
                {['kg', 'g', 'litres', 'portions', 'boxes', 'packets', 'pieces'].map(u => <option key={u}>{u}</option>)}
              </Select>
            </div>
            <div>
              <Label>Approx. Serves (people)</Label>
              <Input type="number" min="1" value={form.serves_people} onChange={e => set('serves_people', e.target.value)} placeholder="50" />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Brief description of the food"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm resize-none" />
            </div>
            <div className="sm:col-span-2">
              <Label>Storage Notes</Label>
              <Input value={form.storage_notes} onChange={e => set('storage_notes', e.target.value)} placeholder="Keep in cool place, consume within 4 hours…" />
            </div>
          </div>

          {/* Dietary flags */}
          <div className="flex flex-wrap gap-3 mt-2">
            {[['is_vegetarian', '🥦 Vegetarian'], ['is_vegan', '🌱 Vegan'], ['is_halal', '☪️ Halal'], ['is_kosher', '✡️ Kosher']].map(([k, label]) => (
              <button key={k} type="button" onClick={() => set(k, !form[k])}
                className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${form[k] ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600 hover:border-green-400'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Allergens */}
          <div className="mt-3">
            <Label>Allergens (if known)</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ALLERGENS.map(a => (
                <button key={a} type="button" onClick={() => toggleAllergen(a)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${form.allergens.includes(a) ? 'bg-red-100 text-red-700 border-red-300' : 'border-gray-300 text-gray-600 hover:border-red-300'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Pickup */}
        <Section title="Pickup Details">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Pickup Address *</Label>
              <Input required value={form.pickup_address} onChange={e => set('pickup_address', e.target.value)} placeholder="123 Kitchen Street" />
            </div>
            <div>
              <Label>City *</Label>
              <Input required value={form.pickup_city} onChange={e => set('pickup_city', e.target.value)} placeholder="Chandigarh" />
            </div>
            <div />
            <div>
              <Label>Latitude *</Label>
              <Input required type="number" step="any" value={form.pickup_latitude} onChange={e => set('pickup_latitude', e.target.value)} placeholder="30.7333" />
            </div>
            <div>
              <Label>Longitude *</Label>
              <Input required type="number" step="any" value={form.pickup_longitude} onChange={e => set('pickup_longitude', e.target.value)} placeholder="76.7794" />
            </div>
            <div className="sm:col-span-2">
              <Label>Pickup Instructions</Label>
              <Input value={form.pickup_instructions} onChange={e => set('pickup_instructions', e.target.value)} placeholder="Ring doorbell, ask for kitchen manager…" />
            </div>
          </div>
        </Section>

        {/* Timing */}
        <Section title="Collection Window">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Collection Available From *</Label>
              <Input required type="datetime-local" value={form.collection_start_time} onChange={e => set('collection_start_time', e.target.value)} />
            </div>
            <div>
              <Label>Pickup Deadline *</Label>
              <Input required type="datetime-local" value={form.pickup_deadline} onChange={e => set('pickup_deadline', e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-amber-600 mt-1">⚠️ Food safety: set deadline before food becomes unsafe to consume.</p>
        </Section>

        {/* Photo */}
        <Section title="Food Photo (optional)">
          <input type="file" accept="image/jpeg,image/png,image/webp"
            onChange={e => setImageFile(e.target.files[0])}
            className="text-sm text-gray-600" />
          <p className="text-xs text-gray-400 mt-1">Max 5 MB · JPEG, PNG, or WebP</p>
        </Section>

        {/* Confirmation */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.donor_confirms_accuracy}
              onChange={e => set('donor_confirms_accuracy', e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-green-600" />
            <span className="text-sm text-amber-900">
              <strong>I confirm</strong> that all food information provided is accurate, the food is safe for consumption,
              and has been handled following applicable food safety guidelines.
            </span>
          </label>
        </div>

        <button type="submit" disabled={loading || !form.donor_confirms_accuracy}
          className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50">
          {loading ? 'Creating listing…' : 'List Donation'}
        </button>
      </form>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide text-green-700">{title}</h3>
      {children}
    </div>
  )
}
function Label({ children }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1">{children}</label>
}
function Input({ className = '', ...props }) {
  return <input {...props} className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm ${className}`} />
}
function Select({ children, className = '', ...props }) {
  return <select {...props} className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm ${className}`}>{children}</select>
}

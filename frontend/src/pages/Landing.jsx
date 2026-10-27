import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const stats = [
  { label: 'Meals Rescued', value: '50,000+', icon: '🍽️' },
  { label: 'Food Donors', value: '200+', icon: '🏪' },
  { label: 'NGOs & Shelters', value: '80+', icon: '🤝' },
  { label: 'kg CO₂ Saved', value: '30,000+', icon: '🌍' },
]

const steps = [
  { step: '1', title: 'Donors List Food', desc: 'Restaurants, canteens and bakeries post available surplus food with pickup details.', icon: '📋' },
  { step: '2', title: 'AI Matches Recipients', desc: 'Our engine scores and ranks verified NGOs by distance, capacity, and food compatibility.', icon: '🤖' },
  { step: '3', title: 'Pickup Coordinated', desc: 'Donor and recipient confirm the handover. A reference code tracks the full chain.', icon: '🚚' },
  { step: '4', title: 'Impact Measured', desc: 'Confirmed deliveries log meals rescued and CO₂ saved — no inflated estimates.', icon: '📊' },
]

const features = [
  { title: 'Surplus Prediction', desc: 'ML model estimates how much food a kitchen will have left — so donors can plan ahead.', icon: '🔮' },
  { title: 'Smart Matching', desc: 'Weighted scoring engine recommends the best recipients based on proximity and compatibility.', icon: '✨' },
  { title: 'Urgent Alerts', desc: 'Expiring donations trigger real-time notifications to eligible recipients nearby.', icon: '⚡' },
  { title: 'Interactive Map', desc: 'Discover nearby donations and recipients on an OpenStreetMap-powered map.', icon: '🗺️' },
  { title: 'Impact Dashboard', desc: 'Track rescued kg, estimated meals, and trend charts — transparent, verified data only.', icon: '📈' },
  { title: 'Secure & Verified', desc: 'JWT auth, role-based access, and admin-verified organizations for a trustworthy platform.', icon: '🔒' },
]

export default function Landing() {
  const { isAuthenticated, user } = useAuthStore()

  const getDashboardPath = () => {
    if (!isAuthenticated) return '/login'
    if (user?.role === 'donor') return '/donor'
    if (user?.role === 'recipient') return '/recipient'
    return '/admin'
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b border-gray-200 sticky top-0 bg-white z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="font-bold text-green-700 text-xl">Food Rescue AI</span>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link to={getDashboardPath()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Sign In</Link>
                <Link to="/register"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-green-50 to-emerald-100 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <span>🌿</span> AI-Powered Food Waste Reduction
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Rescue Surplus Food.<br />
            <span className="text-green-600">Feed Communities.</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Food Rescue AI connects restaurants, canteens and bakeries with NGOs and shelters using 
            intelligent matching, real-time alerts, and transparent impact tracking.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register"
              className="px-8 py-3 bg-green-600 text-white rounded-xl font-semibold text-lg hover:bg-green-700 transition-colors shadow-lg shadow-green-200">
              Start Rescuing Food
            </Link>
            <a href="#how-it-works"
              className="px-8 py-3 bg-white text-green-700 border-2 border-green-200 rounded-xl font-semibold text-lg hover:border-green-400 transition-colors">
              See How It Works
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-3xl mb-1">{s.icon}</div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Problem */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">The Food Waste Crisis</h2>
          <p className="text-gray-600 text-lg mb-8">
            One-third of all food produced globally is wasted — while millions go to bed hungry every night. 
            Much of this waste happens at the last mile: kitchens with surplus food and no efficient way to 
            connect with those who need it.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { val: '1.3B tonnes', label: 'Food wasted annually worldwide' },
              { val: '820M', label: 'People suffering from hunger' },
              { val: '8%', label: 'Of global greenhouse gases from food waste' },
            ].map(item => (
              <div key={item.label} className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-2xl font-bold text-red-600 mb-1">{item.val}</div>
                <div className="text-sm text-gray-600">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">How Food Rescue AI Works</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map(s => (
              <div key={s.step} className="text-center">
                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">
                  {s.icon}
                </div>
                <div className="text-xs font-bold text-green-600 uppercase tracking-wide mb-1">Step {s.step}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Platform Features</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="bg-white p-6 rounded-xl border border-green-100 hover:shadow-md transition-shadow">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-green-700 text-white text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Make a Difference?</h2>
        <p className="text-green-100 mb-8 text-lg">
          Join donors and recipients already reducing food waste in their communities.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/register?role=donor"
            className="px-8 py-3 bg-white text-green-700 rounded-xl font-semibold hover:bg-green-50 transition-colors">
            I'm a Food Donor
          </Link>
          <Link to="/register?role=recipient"
            className="px-8 py-3 bg-green-600 text-white border-2 border-green-400 rounded-xl font-semibold hover:bg-green-500 transition-colors">
            I'm a Recipient Org
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-gray-200 text-center text-sm text-gray-500">
        <p>© 2026 Food Rescue AI — Built as a university major project. Impact estimates use 1 kg ≈ 2 meals assumption.</p>
      </footer>
    </div>
  )
}

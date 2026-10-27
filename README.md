# 🌿 Food Rescue AI — Smart Food Waste Reduction Platform

A full-stack web application that connects food donors (restaurants, canteens, bakeries) with
recipient organizations (NGOs, shelters, community kitchens) using AI-powered matching,
surplus prediction, and transparent impact tracking.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Python 3.14 + FastAPI |
| Database | MongoDB + Motor (async) |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| ML | Pandas + NumPy + Scikit-learn |
| Charts | Recharts |
| Maps | Leaflet + OpenStreetMap |

## Project Structure

```
FoodRescueAI/
├── backend/
│   ├── app/
│   │   ├── auth/          # JWT + bcrypt helpers & dependencies
│   │   ├── matching/      # Weighted donor-recipient scoring engine
│   │   ├── ml/            # Surplus prediction (RF + fallback)
│   │   ├── routes/        # FastAPI routers (auth, donations, pickups…)
│   │   ├── schemas/       # Pydantic request/response models
│   │   ├── services/      # Business logic layer
│   │   ├── config.py      # Settings (env-backed)
│   │   ├── database.py    # Motor connection + indexes
│   │   └── main.py        # App entry point + CORS + background tasks
│   ├── tests/             # Pytest test suite
│   ├── seed_data.py       # Demo data seeder
│   ├── .env               # Local env (never commit)
│   └── requirements.txt
└── frontend/
    └── src/
        ├── layouts/       # DashboardLayout
        ├── pages/         # All 16 pages
        ├── services/      # Axios API client
        ├── store/         # Zustand auth store
        └── utils/         # Helpers (dates, colors, errors)
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB 6+ running on `localhost:27017`

Install MongoDB: https://www.mongodb.com/try/download/community

## Backend Setup

```bash
cd backend

# Copy env file
copy .env.example .env
# Edit .env if needed (MongoDB URL, secret key)

# Install dependencies
pip install -r requirements.txt

# Start the API server
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### Seed Demo Data (optional)

```bash
# With the server running and MongoDB available:
python seed_data.py
```

Demo accounts created:
- **Admin:** admin@foodrescue.ai / Admin@1234
- **Donor:** donor@greencanteen.in / Donor@1234
- **Recipient:** ngo@helphand.org / Recip@1234

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App available at: http://localhost:5173

## Environment Variables (backend/.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017` |
| `DATABASE_NAME` | Database name | `food_rescue_ai` |
| `SECRET_KEY` | JWT signing secret — **change in production** | dev key |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime | `1440` (24h) |
| `UPLOAD_DIR` | Image upload directory | `uploads` |
| `MAX_UPLOAD_SIZE_MB` | Max image size | `5` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `http://localhost:5173` |
| `SMTP_*` | Email settings (optional) | empty |

## Running Tests

```bash
cd backend

# ML unit tests (no MongoDB needed)
python -m pytest tests/test_ml.py -v

# Auth + integration tests (requires MongoDB)
python -m pytest tests/ -v
```

## API Documentation

Interactive Swagger UI: http://localhost:8000/docs
ReDoc: http://localhost:8000/redoc

Key endpoint groups:
- `POST /api/v1/auth/register` — register user
- `POST /api/v1/auth/login` — get JWT token
- `GET/POST /api/v1/donations` — list/create donations
- `GET /api/v1/donations/{id}/recommendations` — AI matching
- `POST /api/v1/predictions` — surplus prediction
- `GET /api/v1/analytics/donor|recipient|admin` — dashboards
- `POST /api/v1/organizations/{id}/verify` — admin verification

## ML Model Notes

The surplus prediction model uses a **Random Forest Regressor** trained on synthetic data.

> ⚠️ The model is trained on **synthetically generated data** for demonstration only.
> It has NOT been validated with real kitchen records.
> Retrain with real data using `POST /api/v1/predictions/retrain` (admin only).

Evaluation:
- Baseline (mean predictor) MAE vs RF MAE logged on each train
- Features: day of week, meal type, attendance, meals prepared, event/holiday flags, food category
- `meals_consumed` is deliberately excluded (not available at prediction time — no data leakage)

## Impact Calculation

Meals rescued = `quantity_kg × 2.0`

This uses the widely-cited estimate of ~2 meals per kg of food.
Only donations with **DELIVERED** status are counted — listings or accepted-but-not-collected donations are excluded.

## User Roles

| Role | Can Do |
|------|--------|
| **Donor** | Create donations, view recommendations, manage pickups, predict surplus |
| **Recipient** | Discover donations, request pickups, confirm collection |
| **Admin** | Verify organizations, manage users, view platform analytics |

## Security Notes

- Passwords hashed with bcrypt (never stored plain)
- JWT tokens validated server-side on every request
- Role is read from the database — never trusted from client payload
- File uploads validated for type and size
- Duplicate claim prevention via atomic MongoDB operations
- Unverified organizations blocked from sensitive features

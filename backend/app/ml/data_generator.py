"""
Generates synthetic training data for surplus prediction.
Clearly labeled as synthetic/sample — not validated with real kitchens.
"""
import numpy as np
import pandas as pd
from datetime import date, timedelta
import random


def generate_synthetic_dataset(n_samples: int = 500, seed: int = 42) -> pd.DataFrame:
    """
    Generate a synthetic dataset for surplus food prediction.
    NOTE: This data is synthetic and used only for model demonstration.
    The model must be retrained with real operational data before deployment.
    """
    rng = np.random.default_rng(seed)
    rows = []

    meal_types = ["breakfast", "lunch", "dinner", "snack"]
    categories = ["cooked_meals", "bakery", "dairy", "fruits_vegetables", "grains_cereals", "snacks"]

    for i in range(n_samples):
        day_of_week = int(rng.integers(0, 7))
        meal_type = random.choice(meal_types)
        is_event = bool(rng.random() < 0.15)
        is_holiday = bool(rng.random() < 0.10)
        food_category = random.choice(categories)

        base_attendance = int(rng.integers(50, 500))
        if is_event:
            base_attendance = int(base_attendance * rng.uniform(1.5, 3.0))
        if is_holiday:
            base_attendance = int(base_attendance * rng.uniform(0.3, 0.7))

        # Weekend slightly lower attendance
        if day_of_week in [5, 6]:
            base_attendance = int(base_attendance * rng.uniform(0.6, 0.9))

        # Meals prepared is usually 10-25% more than attendance
        buffer = rng.uniform(1.10, 1.25)
        meals_prepared = int(base_attendance * buffer)

        # Meals consumed is 70-95% of prepared (with some noise)
        consumption_rate = rng.uniform(0.70, 0.95)
        meals_consumed = int(meals_prepared * consumption_rate)

        leftover_count = max(0, meals_prepared - meals_consumed)

        # Convert to kg: roughly 0.35 kg per meal
        kg_per_meal = rng.uniform(0.25, 0.50)
        leftover_kg = round(leftover_count * kg_per_meal, 2)

        # More leftover on event/holiday days
        if is_event:
            leftover_kg *= rng.uniform(1.1, 1.5)
        if is_holiday:
            leftover_kg *= rng.uniform(1.2, 2.0)

        rows.append({
            "day_of_week": day_of_week,
            "meal_type": meal_type,
            "expected_attendance": base_attendance,
            "meals_prepared": meals_prepared,
            "meals_consumed": meals_consumed,
            "is_event_day": int(is_event),
            "is_holiday": int(is_holiday),
            "food_category": food_category,
            "actual_leftover_kg": round(float(leftover_kg), 2),
        })

    return pd.DataFrame(rows)

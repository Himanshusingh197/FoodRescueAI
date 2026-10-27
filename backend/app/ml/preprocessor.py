"""
Feature engineering and preprocessing for surplus prediction.
Ensures no data leakage: only features available at prediction time are used.
"""
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
from typing import Tuple, List


FEATURE_COLUMNS = [
    "day_of_week",
    "meal_type_encoded",
    "expected_attendance",
    "meals_prepared",
    "is_event_day",
    "is_holiday",
    "food_category_encoded",
    "attendance_to_prepared_ratio",
]

TARGET_COLUMN = "actual_leftover_kg"

MEAL_TYPE_MAP = {
    "breakfast": 0,
    "lunch": 1,
    "dinner": 2,
    "snack": 3,
    "all_day": 4,
}

CATEGORY_MAP = {
    "cooked_meals": 0,
    "bakery": 1,
    "dairy": 2,
    "fruits_vegetables": 3,
    "grains_cereals": 4,
    "beverages": 5,
    "packaged_food": 6,
    "snacks": 7,
    "other": 8,
}


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transform raw input DataFrame into model-ready features.
    NOTE: meals_consumed is NOT included — it is not available at prediction time.
    """
    df = df.copy()

    df["meal_type_encoded"] = df["meal_type"].map(MEAL_TYPE_MAP).fillna(0).astype(int)
    df["food_category_encoded"] = df["food_category"].map(CATEGORY_MAP).fillna(8).astype(int)
    df["is_event_day"] = df["is_event_day"].astype(int)
    df["is_holiday"] = df["is_holiday"].astype(int)

    # Derived: ratio of expected attendance to meals prepared
    df["attendance_to_prepared_ratio"] = df["expected_attendance"] / df["meals_prepared"].replace(0, 1)

    return df


def get_feature_matrix(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    df = engineer_features(df)
    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN] if TARGET_COLUMN in df.columns else None
    return X, y


def prepare_single_prediction(
    day_of_week: int,
    meal_type: str,
    expected_attendance: int,
    meals_prepared: int,
    is_event_day: bool,
    is_holiday: bool,
    food_category: str,
) -> pd.DataFrame:
    row = {
        "day_of_week": day_of_week,
        "meal_type": meal_type.lower(),
        "expected_attendance": expected_attendance,
        "meals_prepared": meals_prepared,
        "is_event_day": int(is_event_day),
        "is_holiday": int(is_holiday),
        "food_category": food_category.lower(),
    }
    df = pd.DataFrame([row])
    df = engineer_features(df)
    return df[FEATURE_COLUMNS]

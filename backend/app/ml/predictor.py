"""
Prediction serving module for surplus food estimation.
"""
import numpy as np
from typing import Dict, Any, List
from app.ml.trainer import load_model, load_meta
from app.ml.preprocessor import prepare_single_prediction, FEATURE_COLUMNS
import logging

logger = logging.getLogger(__name__)

_model = None
_meta = None


def get_model():
    global _model
    if _model is None:
        _model = load_model()
    return _model


def get_meta():
    global _meta
    if _meta is None:
        _meta = load_meta()
    return _meta


def predict_surplus(
    day_of_week: int,
    meal_type: str,
    expected_attendance: int,
    meals_prepared: int,
    is_event_day: bool,
    is_holiday: bool,
    food_category: str,
) -> Dict[str, Any]:
    """
    Predict surplus food quantity for a kitchen session.
    Returns prediction with uncertainty range and feature contributions.
    """
    model = get_model()
    meta = get_meta()

    X = prepare_single_prediction(
        day_of_week=day_of_week,
        meal_type=meal_type,
        expected_attendance=expected_attendance,
        meals_prepared=meals_prepared,
        is_event_day=is_event_day,
        is_holiday=is_holiday,
        food_category=food_category,
    )

    # Get per-tree predictions for uncertainty estimation
    tree_preds = np.array([tree.predict(X)[0] for tree in model.estimators_])
    predicted = float(np.mean(tree_preds))
    std_dev = float(np.std(tree_preds))

    low = max(0.0, round(predicted - std_dev, 2))
    high = round(predicted + std_dev, 2)
    predicted = max(0.0, round(predicted, 2))

    # Confidence label based on std dev relative to prediction
    cv = std_dev / (predicted + 0.01)
    if cv < 0.2:
        confidence = "high"
    elif cv < 0.5:
        confidence = "medium"
    else:
        confidence = "low"

    # Feature importance as explanation
    importance = meta.get("feature_importance", {})
    features_sorted = sorted(importance.items(), key=lambda x: x[1], reverse=True)
    important_features = [
        {"feature": k.replace("_encoded", "").replace("_", " ").title(), "importance": round(v, 4)}
        for k, v in features_sorted[:5]
    ]

    return {
        "predicted_surplus_kg": predicted,
        "predicted_surplus_range_low": low,
        "predicted_surplus_range_high": high,
        "confidence_label": confidence,
        "important_features": important_features,
        "model_used": "RandomForestRegressor",
        "data_note": meta.get("data_note", ""),
        "model_mae_kg": meta.get("rf_mae", None),
        "baseline_mae_kg": meta.get("baseline_mae", None),
    }


def rule_based_fallback(meals_prepared: int, food_category: str) -> Dict[str, Any]:
    """
    Simple rule-based fallback when model is unavailable.
    Assumes 10-20% surplus rate depending on category.
    """
    rate_map = {
        "cooked_meals": 0.15,
        "bakery": 0.20,
        "dairy": 0.10,
        "fruits_vegetables": 0.12,
        "grains_cereals": 0.15,
        "snacks": 0.18,
    }
    rate = rate_map.get(food_category, 0.15)
    kg_per_meal = 0.35
    surplus = round(meals_prepared * rate * kg_per_meal, 2)

    return {
        "predicted_surplus_kg": surplus,
        "predicted_surplus_range_low": round(surplus * 0.7, 2),
        "predicted_surplus_range_high": round(surplus * 1.3, 2),
        "confidence_label": "low",
        "important_features": [],
        "model_used": "rule_based_fallback",
        "data_note": "Rule-based fallback used. Train a model for better estimates.",
        "model_mae_kg": None,
        "baseline_mae_kg": None,
    }

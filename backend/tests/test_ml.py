import pytest
from app.ml.data_generator import generate_synthetic_dataset
from app.ml.preprocessor import get_feature_matrix, prepare_single_prediction
from app.ml.trainer import train_model
from app.ml.predictor import predict_surplus, rule_based_fallback


def test_synthetic_data_generation():
    df = generate_synthetic_dataset(n_samples=100)
    assert len(df) == 100
    assert "actual_leftover_kg" in df.columns
    assert (df["actual_leftover_kg"] >= 0).all()
    # meals_consumed must not be used as a feature (data leakage check)
    from app.ml.preprocessor import FEATURE_COLUMNS
    assert "meals_consumed" not in FEATURE_COLUMNS


def test_feature_engineering_no_leakage():
    df = generate_synthetic_dataset(n_samples=50)
    X, y = get_feature_matrix(df)
    # meals_consumed not in features
    assert "meals_consumed" not in X.columns
    assert len(X) == 50
    assert y is not None


def test_model_training():
    df = generate_synthetic_dataset(n_samples=200)
    meta = train_model(df, use_synthetic=True)
    assert "rf_mae" in meta
    assert "baseline_mae" in meta
    assert meta["rf_mae"] >= 0
    assert "SYNTHETIC" in meta["data_note"]


def test_prediction_output():
    result = predict_surplus(
        day_of_week=1,
        meal_type="lunch",
        expected_attendance=200,
        meals_prepared=240,
        is_event_day=False,
        is_holiday=False,
        food_category="cooked_meals",
    )
    assert result["predicted_surplus_kg"] >= 0
    assert result["predicted_surplus_range_low"] <= result["predicted_surplus_kg"]
    assert result["predicted_surplus_range_high"] >= result["predicted_surplus_kg"]
    assert result["confidence_label"] in ["high", "medium", "low"]
    assert len(result["important_features"]) > 0


def test_fallback_prediction():
    result = rule_based_fallback(200, "cooked_meals")
    assert result["predicted_surplus_kg"] >= 0
    assert result["model_used"] == "rule_based_fallback"


def test_prediction_non_negative():
    result = predict_surplus(
        day_of_week=6,
        meal_type="breakfast",
        expected_attendance=10,
        meals_prepared=12,
        is_event_day=False,
        is_holiday=True,
        food_category="bakery",
    )
    assert result["predicted_surplus_kg"] >= 0
    assert result["predicted_surplus_range_low"] >= 0

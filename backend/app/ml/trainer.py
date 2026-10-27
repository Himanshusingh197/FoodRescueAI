"""
Model training, evaluation, and persistence for surplus prediction.
Compares baseline (mean) with Random Forest Regressor.
"""
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
from typing import Dict, Any, Tuple
from app.ml.preprocessor import get_feature_matrix, FEATURE_COLUMNS
from app.ml.data_generator import generate_synthetic_dataset
import logging

logger = logging.getLogger(__name__)

MODEL_PATH = "app/ml/models/surplus_rf_model.joblib"
MODEL_META_PATH = "app/ml/models/model_meta.joblib"


def train_model(df: pd.DataFrame = None, use_synthetic: bool = False) -> Dict[str, Any]:
    """
    Train Random Forest and compare against baseline.
    Returns evaluation metrics and saves model to disk.

    If use_synthetic=True, clearly labels data as synthetic.
    """
    if df is None or len(df) < 50:
        logger.warning("Insufficient data — using synthetic dataset for demonstration only.")
        df = generate_synthetic_dataset(n_samples=600)
        use_synthetic = True

    X, y = get_feature_matrix(df)

    # Time-based split when data has order, otherwise standard split
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    # Baseline: mean of training target
    baseline_pred = np.full(len(y_test), y_train.mean())
    baseline_mae = mean_absolute_error(y_test, baseline_pred)

    # Random Forest
    rf = RandomForestRegressor(
        n_estimators=100,
        max_depth=8,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train, y_train)
    rf_pred = rf.predict(X_test)
    rf_mae = mean_absolute_error(y_test, rf_pred)

    # Feature importance
    importance = dict(zip(FEATURE_COLUMNS, rf.feature_importances_))

    # Save model
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(rf, MODEL_PATH)

    meta = {
        "baseline_mae": round(baseline_mae, 3),
        "rf_mae": round(rf_mae, 3),
        "improvement_over_baseline": round(baseline_mae - rf_mae, 3),
        "feature_importance": {k: round(float(v), 4) for k, v in importance.items()},
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "data_note": (
            "SYNTHETIC DATA: This model was trained on synthetically generated data "
            "for demonstration purposes. It has NOT been validated with real kitchen records. "
            "Retrain with real operational data before relying on predictions."
        ) if use_synthetic else "Trained on real operational data.",
    }
    joblib.dump(meta, MODEL_META_PATH)

    logger.info(f"Model trained. Baseline MAE: {baseline_mae:.3f}, RF MAE: {rf_mae:.3f}")
    return meta


def load_model():
    """Load trained model from disk. Auto-trains if not found."""
    if not os.path.exists(MODEL_PATH):
        logger.info("No trained model found — training on synthetic data.")
        train_model(use_synthetic=True)
    return joblib.load(MODEL_PATH)


def load_meta() -> Dict[str, Any]:
    if not os.path.exists(MODEL_META_PATH):
        train_model(use_synthetic=True)
    return joblib.load(MODEL_META_PATH)

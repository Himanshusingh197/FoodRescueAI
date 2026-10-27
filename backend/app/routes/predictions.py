from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from app.schemas.prediction import PredictionRequest, PredictionResponse
from app.schemas.common import ResponseModel
from app.ml.predictor import predict_surplus, rule_based_fallback
from app.ml.trainer import train_model, load_meta
from app.services.organization_service import get_organization_by_user
from app.auth.dependencies import get_current_user, require_admin
from app.database import get_db
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/predictions", tags=["Surplus Predictions"])


@router.post("", response_model=ResponseModel)
async def create_prediction(data: PredictionRequest, current_user=Depends(get_current_user)):
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="No organization registered")

    try:
        result = predict_surplus(
            day_of_week=data.prediction_date.weekday(),
            meal_type=data.meal_type.value,
            expected_attendance=data.expected_attendance,
            meals_prepared=data.meals_prepared,
            is_event_day=data.is_event_day,
            is_holiday=data.is_holiday,
            food_category=data.food_category,
        )
    except Exception as e:
        logger.warning(f"ML prediction failed, using fallback: {e}")
        result = rule_based_fallback(data.meals_prepared, data.food_category)

    db = get_db()
    now = datetime.now(timezone.utc)
    prediction_doc = {
        "org_id": org["id"],
        "prediction_date": str(data.prediction_date),
        "meal_type": data.meal_type.value,
        "expected_attendance": data.expected_attendance,
        "meals_prepared": data.meals_prepared,
        "food_category": data.food_category,
        "is_event_day": data.is_event_day,
        "is_holiday": data.is_holiday,
        **result,
        "created_at": now,
    }
    insert_result = await db.surplus_predictions.insert_one(prediction_doc)
    prediction_doc["id"] = str(insert_result.inserted_id)
    prediction_doc.pop("_id", None)

    return ResponseModel(success=True, data=prediction_doc)


@router.get("/my", response_model=ResponseModel)
async def my_predictions(current_user=Depends(get_current_user)):
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="No organization registered")
    db = get_db()
    cursor = db.surplus_predictions.find({"org_id": org["id"]}).sort("created_at", -1).limit(20)
    predictions = []
    async for p in cursor:
        p["id"] = str(p["_id"])
        p.pop("_id", None)
        predictions.append(p)
    return ResponseModel(success=True, data=predictions)


@router.post("/retrain", response_model=ResponseModel)
async def retrain_model(_=Depends(require_admin())):
    """Trigger model retraining (admin only). Uses synthetic data if no real data available."""
    try:
        meta = train_model(use_synthetic=True)
        return ResponseModel(success=True, message="Model retrained", data=meta)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@router.get("/model-info", response_model=ResponseModel)
async def model_info(current_user=Depends(get_current_user)):
    try:
        meta = load_meta()
        return ResponseModel(success=True, data=meta)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not load model info: {str(e)}")

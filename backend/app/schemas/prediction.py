from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum


class MealType(str, Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    SNACK = "snack"
    ALL_DAY = "all_day"


class PredictionRequest(BaseModel):
    org_id: str
    prediction_date: date
    meal_type: MealType
    expected_attendance: int = Field(..., ge=1, le=100000)
    meals_prepared: int = Field(..., ge=1, le=100000)
    food_category: str
    is_event_day: bool = False
    is_holiday: bool = False


class PredictionResponse(BaseModel):
    id: Optional[str] = None
    org_id: str
    prediction_date: date
    meal_type: MealType
    predicted_surplus_kg: float
    predicted_surplus_range_low: float
    predicted_surplus_range_high: float
    confidence_label: str
    important_features: List[Dict[str, Any]]
    model_used: str
    data_note: str
    created_at: Optional[datetime] = None


class TrainingDataPoint(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    meal_type: MealType
    expected_attendance: int = Field(..., ge=1)
    meals_prepared: int = Field(..., ge=1)
    meals_consumed: int = Field(..., ge=0)
    is_event_day: bool = False
    is_holiday: bool = False
    food_category: str
    actual_leftover_kg: float = Field(..., ge=0)

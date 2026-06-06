import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Strategy
# ---------------------------------------------------------------------------

class StrategyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    settings: dict  # JSON object of client settings


class StrategyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    settings: dict | None = None


class StrategyResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    settings: dict
    assignment_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StrategyListResponse(BaseModel):
    strategies: list[StrategyResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Strategy Assignments
# ---------------------------------------------------------------------------

class StrategyAssignmentCreate(BaseModel):
    target_type: str = Field(..., pattern="^(device|user|device_group)$")
    target_id: str = Field(..., min_length=1, max_length=255)
    priority: int = 0


class StrategyAssignmentResponse(BaseModel):
    id: uuid.UUID
    strategy_id: uuid.UUID
    target_type: str
    target_id: str
    target_name: str | None = None
    priority: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Effective Strategy
# ---------------------------------------------------------------------------

class EffectiveStrategyResponse(BaseModel):
    device_id: str
    merged_settings: dict
    applied_strategies: list[dict]  # [{strategy_id, name, priority, source}]

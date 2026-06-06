from pydantic import BaseModel, Field


class TOTPSetupResponse(BaseModel):
    secret: str
    qr_uri: str
    qr_base64: str


class TOTPVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class TOTPDisableRequest(BaseModel):
    current_password: str

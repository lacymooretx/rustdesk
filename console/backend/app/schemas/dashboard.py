from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_devices: int
    enabled_devices: int
    disabled_devices: int
    online_devices: int = 0

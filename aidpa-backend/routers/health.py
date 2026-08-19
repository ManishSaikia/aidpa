from fastapi import APIRouter
from models.base import APIResponse

router = APIRouter()

@router.get("/", response_model=APIResponse[dict])
def health():
    return APIResponse(success=True, data={"status": "ok"}, error=None)


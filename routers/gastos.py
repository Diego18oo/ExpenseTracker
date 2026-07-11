from fastapi import APIRouter, HTTPException
from database import get_supabase

router = APIRouter(prefix="/gastos", tags=["Gastos"])
supabase = get_supabase()

@router.get("/")
def obtener_gastos():
    try:
        # Seleccionamos todo (*) y ordenamos por fecha descendente
        respuesta = supabase.table("gastos").select("*").order("fecha_gasto", desc=True).execute()
        return {"gastos": respuesta.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
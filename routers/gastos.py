from fastapi import APIRouter, HTTPException
from database import get_supabase

# Importamos script
from scripts.extractor_gastos import extraer_y_guardar_gastos 

router = APIRouter(prefix="/gastos", tags=["Gastos"])
supabase = get_supabase()

@router.get("/")
def obtener_gastos():
    try:
        respuesta = supabase.table("gastos").select("*").order("fecha_gasto", desc=True).execute()
        return {"gastos": respuesta.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sincronizar")
def sincronizar_correos():
    try:
        # Ejecutamos el script y guardamos lo que retorna
        resultado = extraer_y_guardar_gastos()
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al sincronizar: {str(e)}")
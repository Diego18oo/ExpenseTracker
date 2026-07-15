from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
import os
from database import get_supabase
from scripts.extractor_gastos import extraer_y_guardar_gastos 

router = APIRouter(prefix="/gastos", tags=["Gastos"])
supabase = get_supabase()

MI_USUARIO_ID = os.getenv("MI_USUARIO_ID")

# ==========================================
# MODELOS DE VALIDACIÓN 
# ==========================================
class GastoManual(BaseModel):
    monto: float
    comercio: str
    fecha_gasto: str
    categoria_id: Optional[int] = None

class GastoActualizar(BaseModel):
    monto: Optional[float] = None
    comercio: Optional[str] = None
    fecha_gasto: Optional[str] = None
    categoria_id: Optional[int] = None

# ==========================================
# ENDPOINTS EXISTENTES
# ==========================================
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
        resultado = extraer_y_guardar_gastos()
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al sincronizar: {str(e)}")

# ==========================================
# NUEVOS ENDPOINTS CRUD
# ==========================================
@router.post("/manual")
def agregar_gasto_manual(gasto: GastoManual):
    try:
        nuevo_gasto = {
            "usuario_id": MI_USUARIO_ID,
            "monto": gasto.monto,
            "comercio": gasto.comercio,
            "fecha_gasto": gasto.fecha_gasto,
            "categoria_id": gasto.categoria_id,
            # Genera un ID falso único para el id_mensaje ya que no viene de un correo
            "id_mensaje": f"manual_{uuid.uuid4()}" 
        }
        respuesta = supabase.table("gastos").insert(nuevo_gasto).execute()
        return {"mensaje": "Gasto agregado correctamente", "gasto": respuesta.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{gasto_id}")
def actualizar_gasto(gasto_id: str, gasto: GastoActualizar):
    try:
        # Solo actualizamos los campos que el usuario haya enviado
        datos_actualizar = {k: v for k, v in gasto.dict().items() if v is not None}
        respuesta = supabase.table("gastos").update(datos_actualizar).eq("id", gasto_id).execute()
        return {"mensaje": "Gasto actualizado", "gasto": respuesta.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{gasto_id}")
def eliminar_gasto(gasto_id: str):
    try:
        supabase.table("gastos").delete().eq("id", gasto_id).execute()
        return {"mensaje": "Gasto eliminado correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
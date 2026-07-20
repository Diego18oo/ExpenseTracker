from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
import uuid
from database import get_supabase
from scripts.extractor_gastos import extraer_y_guardar_gastos 

router = APIRouter(prefix="/gastos", tags=["Gastos"])
supabase = get_supabase()

# Validar JWT
def obtener_usuario_id(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token faltante o inválido")
    
    token = authorization.split(" ")[1]
    try:
        # Validamos el token y obtenemos al usuario real
        user_response = supabase.auth.get_user(token)
        return user_response.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Sesión expirada. Inicia sesión nuevamente.")

# MODELOS DE VALIDACIÓN
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

# ENDPOINTS 
@router.get("/")
def obtener_gastos(usuario_id: str = Depends(obtener_usuario_id)):
    try:
        # Solo trae los gastos de ESTE usuario
        respuesta = supabase.table("gastos").select("*").eq("usuario_id", usuario_id).order("fecha_gasto", desc=True).execute()
        return {"gastos": respuesta.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sincronizar")
def sincronizar_correos(usuario_id: str = Depends(obtener_usuario_id)):
    try:
        # Le pasamos el ID real al script de extracción
        resultado = extraer_y_guardar_gastos(usuario_id)
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al sincronizar: {str(e)}")

@router.post("/manual")
def agregar_gasto_manual(gasto: GastoManual, usuario_id: str = Depends(obtener_usuario_id)):
    try:
        nuevo_gasto = {
            "usuario_id": usuario_id, # Se usa el ID del token
            "monto": gasto.monto,
            "comercio": gasto.comercio,
            "fecha_gasto": gasto.fecha_gasto,
            "categoria_id": gasto.categoria_id,
            "id_mensaje": f"manual_{uuid.uuid4()}" 
        }
        respuesta = supabase.table("gastos").insert(nuevo_gasto).execute()
        return {"mensaje": "Gasto agregado correctamente", "gasto": respuesta.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{gasto_id}")
def actualizar_gasto(gasto_id: str, gasto: GastoActualizar, usuario_id: str = Depends(obtener_usuario_id)):
    try:
        datos_actualizar = {k: v for k, v in gasto.dict().items() if v is not None}
        respuesta = supabase.table("gastos").update(datos_actualizar).eq("id", gasto_id).eq("usuario_id", usuario_id).execute()
        
        # ¡Validación nueva! Verificamos si realmente se modificó alguna fila
        if not respuesta.data:
            raise HTTPException(status_code=404, detail="Gasto no encontrado o no tienes permiso para editarlo")
            
        return {"mensaje": "Gasto actualizado correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{gasto_id}")
def eliminar_gasto(gasto_id: str, usuario_id: str = Depends(obtener_usuario_id)):
    try:
        respuesta = supabase.table("gastos").delete().eq("id", gasto_id).eq("usuario_id", usuario_id).execute()
        
        # ¡Validación nueva!
        if not respuesta.data:
             raise HTTPException(status_code=404, detail="Gasto no encontrado o no tienes permiso para eliminarlo")
             
        return {"mensaje": "Gasto eliminado correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
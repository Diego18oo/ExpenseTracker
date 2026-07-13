import os.path
import base64
import re
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from datetime import datetime
import email.utils

# Importamos la conexión de database.py
from database import get_supabase

supabase = get_supabase()
MI_USUARIO_ID = os.getenv("MI_USUARIO_ID")

QUERY_BUSQUEDA = "from:santander (compra OR cargo) (monto OR autorizacion) -documentacion"
MAX_CORREOS = 5

def obtener_servicio_gmail():
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', ['https://www.googleapis.com/auth/gmail.readonly'])
        return build('gmail', 'v1', credentials=creds)
    else:
        raise Exception("No se encontró token.json.")

def decodificar_cuerpo(payload):
    cuerpo = ""
    if 'parts' in payload:
        for parte in payload['parts']:
            if parte['mimeType'] == 'text/plain':
                data = parte['body'].get('data')
                if data:
                    cuerpo = base64.urlsafe_b64decode(data).decode('utf-8')
                    break
    else:
        data = payload['body'].get('data')
        if data:
            cuerpo = base64.urlsafe_b64decode(data).decode('utf-8')
    return cuerpo

def limpiar_html(texto_bruto):
    return re.sub(r'<[^>]+>', ' ', texto_bruto)

def formatear_fecha_para_postgres(fecha_str):
    try:
        fecha_tupla = email.utils.parsedate_tz(fecha_str)
        if fecha_tupla:
            timestamp = email.utils.mktime_tz(fecha_tupla)
            dt = datetime.fromtimestamp(timestamp)
            return dt.isoformat()
    except Exception:
        pass
    return datetime.now().isoformat()

def extraer_y_guardar_gastos():
    servicio = obtener_servicio_gmail()
    resultados = servicio.users().messages().list(userId='me', q=QUERY_BUSQUEDA, maxResults=MAX_CORREOS).execute()
    mensajes = resultados.get('messages', [])

    if not mensajes:
        return {"agregados": 0, "gastos": [], "mensaje": "No hay correos nuevos."}

    gastos_agregados = []

    for msg in mensajes:
        txt = servicio.users().messages().get(userId='me', id=msg['id'], format='full').execute()
        payload = txt['payload']
        headers = payload.get('headers', [])
        
        fecha_correo = next((h['value'] for h in headers if h['name'] == 'Date'), None)
        fecha_formateada = formatear_fecha_para_postgres(fecha_correo)
        
        cuerpo_limpio = limpiar_html(decodificar_cuerpo(payload))
        
        match_monto = re.search(r'\$\s?([\d,]+\.\d{2})', cuerpo_limpio)
        monto = float(match_monto.group(1).replace(',', '')) if match_monto else 0.0
        
        match_comercio = re.search(r'(?i)comercio\s+(.*?)\s+con tu tarjeta', cuerpo_limpio)
        comercio = match_comercio.group(1).strip() if match_comercio else "No detectado"

        if monto <= 0.0 or comercio == "No detectado":
            continue

        nuevo_gasto = {
            "usuario_id": MI_USUARIO_ID,
            "monto": monto,
            "comercio": comercio,
            "fecha_gasto": fecha_formateada,
            "id_mensaje": msg['id']
        }
        
        try:
            supabase.table('gastos').insert(nuevo_gasto).execute()
            gastos_agregados.append(nuevo_gasto)
        except Exception as e:
            # Si ya existe (23505), simplemente lo saltamos sin quebrar el código
            if "23505" not in str(e):
                print(f"Error inesperado: {e}")

    return {
        "agregados": len(gastos_agregados), 
        "gastos": gastos_agregados,
        "mensaje": "Sincronización exitosa."
    }
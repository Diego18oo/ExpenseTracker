import os.path
import base64
import re
from google.oauth2.credentials import Credentials
from dotenv import load_dotenv
from googleapiclient.discovery import build
from supabase import create_client, Client
from datetime import datetime
import email.utils

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
MI_USUARIO_ID = os.getenv("MI_USUARIO_ID")

# Inicializar cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ==========================================
# CONFIGURACIÓN GMAIL
# ==========================================
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
    """Convierte la fecha del correo a un formato compatible con Supabase (ISO 8601)"""
    try:
        # Convierte el string RFC2822 del correo a una tupla y luego a datetime
        fecha_tupla = email.utils.parsedate_tz(fecha_str)
        if fecha_tupla:
            timestamp = email.utils.mktime_tz(fecha_tupla)
            dt = datetime.fromtimestamp(timestamp)
            return dt.isoformat()
    except Exception as e:
        print(f"Error parseando fecha: {e}")
    return datetime.now().isoformat()

def extraer_y_guardar_gastos():
    servicio = obtener_servicio_gmail()
    print(f"Buscando los últimos {MAX_CORREOS} correos...")
    
    resultados = servicio.users().messages().list(userId='me', q=QUERY_BUSQUEDA, maxResults=MAX_CORREOS).execute()
    mensajes = resultados.get('messages', [])

    if not mensajes:
        print("No hay correos nuevos.")
        return

    for msg in mensajes:
        txt = servicio.users().messages().get(userId='me', id=msg['id'], format='full').execute()
        payload = txt['payload']
        headers = payload.get('headers', [])
        
        fecha_correo = next((header['value'] for header in headers if header['name'] == 'Date'), None)
        fecha_formateada = formatear_fecha_para_postgres(fecha_correo)
        
        cuerpo_limpio = limpiar_html(decodificar_cuerpo(payload))
        
        match_monto = re.search(r'\$\s?([\d,]+\.\d{2})', cuerpo_limpio)
        monto = float(match_monto.group(1).replace(',', '')) if match_monto else 0.0
        
        match_comercio = re.search(r'(?i)comercio\s+(.*?)\s+con tu tarjeta', cuerpo_limpio)
        comercio = match_comercio.group(1).strip() if match_comercio else "No detectado"

        #validacion anti correos bait
        if monto <= 0.0 or comercio == "No detectado":
            print(f"⏩ Saltado (Correo informativo ignorado): ID {msg['id']}")
            continue

        # Preparamos el diccionario para insertar en Supabase
        nuevo_gasto = {
            "usuario_id": MI_USUARIO_ID,
            "monto": monto,
            "comercio": comercio,
            "fecha_gasto": fecha_formateada,
            "id_mensaje": msg['id']
        }
        
        # Intentamos guardar en la BD
        try:
            respuesta = supabase.table('gastos').insert(nuevo_gasto).execute()
            print(f"✅ Guardado en BD: ${monto} en {comercio}")
        except Exception as e:
            # Si el id_mensaje ya existe, Supabase lanzará un error de llave duplicada
            if "duplicate key value" in str(e) or "23505" in str(e):
                print(f"⏩ Saltado (Ya existía): ${monto} en {comercio}")
            else:
                print(f"❌ Error al guardar: {e}")

if __name__ == '__main__':
    extraer_y_guardar_gastos()
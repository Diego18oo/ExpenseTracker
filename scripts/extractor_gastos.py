import os
import sys
import base64
import re
from datetime import datetime
import email.utils

# Importaciones de Google para generar el token
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# ARREGLO DE RUTAS DE IMPORTACIÓN
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database import get_supabase

supabase = get_supabase()

QUERY_BUSQUEDA = "from:santander (compra OR cargo) (monto OR autorizacion) -documentacion"
MAX_CORREOS = 10
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']


# GENERADOR DE TOKENS DE GOOGLE

def obtener_servicio_gmail():
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    # Si no hay credenciales o no son válidas, hacemos el flujo de login
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            
            ruta_credenciales = os.path.join(os.path.dirname(__file__), '..', 'credentials.json')
            flow = InstalledAppFlow.from_client_secrets_file(ruta_credenciales, SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Guardar el token 
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
            
    return build('gmail', 'v1', credentials=creds)

# FUNCIONES DE EXTRACCIÓN 
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

def extraer_y_guardar_gastos(usuario_id):
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
            "usuario_id": usuario_id, # Usamos el parámetro dinámico
            "monto": monto,
            "comercio": comercio,
            "fecha_gasto": fecha_formateada,
            "id_mensaje": msg['id']
        }
        
        try:
            supabase.table('gastos').insert(nuevo_gasto).execute()
            gastos_agregados.append(nuevo_gasto)
        except Exception as e:
            if "23505" not in str(e):
                print(f"Error inesperado: {e}")

    return {
        "agregados": len(gastos_agregados), 
        "gastos": gastos_agregados,
        "mensaje": "Sincronización exitosa."
    }

# EJECUCIÓN MANUAL
# Para cuando se ejecuta desde la consola
if __name__ == '__main__':
    print("Verificando permisos de Gmail...")
    
    # Pega aquí el ID que te aparece al final de tu página web
    ID_PRUEBA = "fdb6ce93-8c3c-4cbf-a681-db35345fb68d" 
    
    resultado = extraer_y_guardar_gastos(ID_PRUEBA)
    print(f"\nFinalizado: {resultado['mensaje']} - Gastos insertados: {resultado['agregados']}")
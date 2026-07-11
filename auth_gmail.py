import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# ==========================================
# CONFIGURACIÓN DE PERMISOS
# Si modificas estos scopes, debes eliminar el archivo token.json
# ==========================================
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def obtener_credenciales():
    """
    Maneja el flujo de OAuth 2.0. 
    Si ya existe un token válido, lo usa. Si no, abre el navegador para autorizar.
    """
    creds = None
    
    # El archivo token.json almacena los tokens de acceso y actualización del usuario.
    # Se crea automáticamente cuando el flujo de autorización se completa por primera vez.
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        
    # Si no hay credenciales válidas disponibles, obligamos al usuario a iniciar sesión.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Refrescando el token de acceso...")
            creds.refresh(Request())
        else:
            print("Iniciando flujo de autorización en el navegador...")
            # Aquí es donde lee tu credentials.json
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            # Levanta un servidor local temporal para recibir la respuesta de Google
            creds = flow.run_local_server(port=8000)
            
        # Guardamos las credenciales para la próxima ejecución
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
            print("¡Nuevo token guardado exitosamente!")
            
    return creds

def probar_conexion_api():
    """
    Función de prueba para validar que la conexión a la API de Gmail funciona.
    """
    creds = obtener_credenciales()
    
    try:
        # Construimos el servicio para interactuar con la API de Gmail
        servicio = build('gmail', 'v1', credentials=creds)
        
        # Llamada de prueba: Obtener el perfil del usuario autenticado
        perfil = servicio.users().getProfile(userId='me').execute()
        
        print("\n" + "="*40)
        print("✅ CONEXIÓN EXITOSA")
        print(f"Bandeja conectada: {perfil['emailAddress']}")
        print(f"Total de mensajes en la cuenta: {perfil['messagesTotal']}")
        print("="*40 + "\n")
        
    except Exception as error:
        print(f"❌ Ocurrió un error al conectar con la API: {error}")

if __name__ == '__main__':
    probar_conexion_api()
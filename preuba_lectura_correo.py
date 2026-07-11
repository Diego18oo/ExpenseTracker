import imaplib
import email
from email.header import decode_header
import re
from dotenv import load_dotenv
import os.path

load_dotenv()
IMAP_SERVER = os.getenv("IMAP_SERVER")
EMAIL_ACCOUNT = os.getenv("EMAIL_ACCOUNT")
PASSWORD = os.getenv("PASSWORD")

def probar_lectura_santander():
    try:
        print("Conectando al servidor IMAP...")
        # 1. Iniciar conexión segura
        mail = imaplib.IMAP4_SSL(IMAP_SERVER)
        mail.login(EMAIL_ACCOUNT, PASSWORD)
        print("¡Conexión exitosa!\n")
        
        # 2. Seleccionar la bandeja de entrada
        mail.select("inbox")
        
        # 3. Buscar correos 
        # Buscamos correos que contengan "Santander" en el remitente. 
        # También podrías usar: '(UNSEEN SUBJECT "Notificación")' para correos no leídos.
        status, mensajes = mail.search(None, '(FROM "santander")')
        
        # messages[0] contiene una cadena con los IDs de los correos separados por espacio
        lista_ids = mensajes[0].split()
        print(f"Se encontraron {len(lista_ids)} correos coincidiendo con la búsqueda.")
        
        # 4. Leer el correo más reciente (el último de la lista)
        if lista_ids:
            ultimo_id = lista_ids[-2]
            # Fetch trae la información del correo (RFC822 es el estándar completo del mensaje)
            status, msg_data = mail.fetch(ultimo_id, "(RFC822)")
            
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    # Parsear los bytes a un objeto email
                    msg = email.message_from_bytes(response_part[1])
                    
                    # Decodificar el asunto para que lea bien los acentos
                    subject, encoding = decode_header(msg["Subject"])[0]
                    if isinstance(subject, bytes):
                        subject = subject.decode(encoding if encoding else "utf-8")
                    
                    print(f"\n{'-'*30}")
                    print(f"ASUNTO: {subject}")
                    print(f"DE: {msg.get('From')}")
                    print(f"{'-'*30}")
                    
                    # 5. Extraer el cuerpo del correo
                    body = ""
                    # Los correos suelen venir en varias partes (HTML y Texto Plano)
                    if msg.is_multipart():
                        for part in msg.walk():
                            # Nos interesa el texto plano para que sea más fácil extraer el dinero
                            if part.get_content_type() == "text/plain":
                                body = part.get_payload(decode=True).decode()
                                break 
                    else:
                        body = msg.get_payload(decode=True).decode()
                    
                    print("CUERPO DEL MENSAJE (Extracto):")
                    print(body[:300] + "...\n") 
                    
                    # 6. Ejemplo de Extracción con Regex
                    # Aquí es donde harás la magia. Suponiendo que el correo dice "Por un monto de $1,250.50"
                    print("Intentando extraer monto...")
                    # Esta regex busca un signo $, seguido de números, comas opcionales y un punto decimal
                    match_monto = re.search(r'\$\s?([\d,]+\.\d{2})', body)
                    
                    if match_monto:
                        print(f"✅ Monto detectado: ${match_monto.group(1)}")
                    else:
                        print("❌ No se pudo detectar un monto con la regla actual.")
        
        # Cerrar todo ordenadamente
        mail.close()
        mail.logout()
        
    except Exception as e:
        print(f"Hubo un error fatal: {e}")

if __name__ == "__main__":
    probar_lectura_santander()
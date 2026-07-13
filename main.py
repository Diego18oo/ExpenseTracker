from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import gastos

app = FastAPI(
    title="Expense Tracker API",
    description="API para rastreo automático de gastos",
    version="1.0.0"
)

# --- CONFIGURACIÓN DE CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción aquí va la URL del frontend
    allow_credentials=True,
    allow_methods=["*"], # Permite GET, POST, etc.
    allow_headers=["*"],
)

app.include_router(gastos.router)

@app.get("/")
def root():
    return {"mensaje": "ESTA VIVO! "}
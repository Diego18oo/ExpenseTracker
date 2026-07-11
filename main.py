from fastapi import FastAPI
from routers import gastos

app = FastAPI(
    title="Expense Tracker API",
    description="API para rastreo automático de gastos",
    version="1.0.0"
)

# Registramos las rutas
app.include_router(gastos.router)

@app.get("/")
def root():
    return {"mensaje": "Estoy dentro "}
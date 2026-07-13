import { useState, useEffect } from 'react'
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
function App() {
  const [gastos, setGastos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)

  // Función para traer los gastos (GET)
  const cargarGastos = async () => {
    setCargando(true)
    try {
      const respuesta = await fetch(`${API_URL}/gastos/`);
      const data = await respuesta.json()
      setGastos(data.gastos)
    } catch (error) {
      console.error("Error al cargar los gastos:", error)
    }
    setCargando(false)
  }

  // Función para sincronizar correos (POST)
  const sincronizarCorreos = async () => {
    setSincronizando(true)
    try {
      const respuesta = await fetch(`${API_URL}/gastos/sincronizar`, {
        method: 'POST'
      })
      const data = await respuesta.json()
      alert(data.mensaje + ` (${data.agregados} gastos nuevos)`)
      // Recargamos la lista para ver los nuevos datos
      cargarGastos() 
    } catch (error) {
      console.error("Error al sincronizar:", error)
      alert("Hubo un error al sincronizar")
    }
    setSincronizando(false)
  }

  // Cargar datos cuando se abre la página
  useEffect(() => {
    cargarGastos()
  }, [])

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', fontFamily: 'system-ui', padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Mis Gastos 💸</h1>
        <button 
          onClick={sincronizarCorreos} 
          disabled={sincronizando}
          style={{ padding: '10px 15px', cursor: 'pointer', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          {sincronizando ? '🔄 Buscando...' : '🔄 Sincronizar Gmail'}
        </button>
      </header>

      {cargando ? (
        <p>Cargando datos...</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {gastos.map((gasto) => (
            <li key={gasto.id} style={{ borderBottom: '1px solid #eaeaea', padding: '15px 0', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{gasto.comercio}</strong>
                <br/>
                <small style={{ color: '#666' }}>{new Date(gasto.fecha_gasto).toLocaleDateString()}</small>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                ${gasto.monto}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App
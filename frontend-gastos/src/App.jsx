import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Categorías que creaste en tu base de datos
const CATEGORIAS = [
  { id: 1, nombre: 'Alimentos y Bebidas' },
  { id: 2, nombre: 'Transporte' },
  { id: 3, nombre: 'Suscripciones y Software' },
  { id: 4, nombre: 'Apuestas y Juegos' },
  { id: 5, nombre: 'Entretenimiento' },
  { id: 6, nombre: 'Otros' }
];

function App() {
  const [gastos, setGastos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  
  // Estado para el formulario (Crear/Editar)
  const [formData, setFormData] = useState({ id: null, monto: '', comercio: '', fecha_gasto: '', categoria_id: '' })

  const cargarGastos = async () => {
    setCargando(true)
    try {
      const respuesta = await fetch(`${API_URL}/gastos/`)
      const data = await respuesta.json()
      setGastos(data.gastos)
    } catch (error) {
      console.error("Error al cargar los gastos:", error)
    }
    setCargando(false)
  }

  const sincronizarCorreos = async () => {
    setSincronizando(true)
    try {
      const respuesta = await fetch(`${API_URL}/gastos/sincronizar`, { method: 'POST' })
      const data = await respuesta.json()
      alert(data.mensaje + ` (${data.agregados} gastos nuevos)`)
      cargarGastos() 
    } catch (error) {
      console.error("Error al sincronizar:", error)
    }
    setSincronizando(false)
  }

  // --- NUEVAS FUNCIONALIDADES CRUD ---

  const manejarCambioInput = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const guardarGasto = async (e) => {
    e.preventDefault()
    const url = formData.id ? `${API_URL}/gastos/${formData.id}` : `${API_URL}/gastos/manual`
    const metodo = formData.id ? 'PUT' : 'POST'
    
    // Preparar datos asegurando los tipos correctos
    const bodyData = {
      monto: parseFloat(formData.monto),
      comercio: formData.comercio,
      fecha_gasto: formData.fecha_gasto,
      categoria_id: formData.categoria_id ? parseInt(formData.categoria_id) : null
    }

    try {
      await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      })
      alert(`Gasto ${formData.id ? 'actualizado' : 'agregado'} con éxito`)
      setFormData({ id: null, monto: '', comercio: '', fecha_gasto: '', categoria_id: '' }) // Limpiar formulario
      cargarGastos()
    } catch (error) {
      console.error("Error al guardar:", error)
    }
  }

  const editarGasto = (gasto) => {
    // Formatear la fecha para el input tipo date
    const fecha = new Date(gasto.fecha_gasto).toISOString().split('T')[0]
    setFormData({
      id: gasto.id,
      monto: gasto.monto,
      comercio: gasto.comercio,
      fecha_gasto: fecha,
      categoria_id: gasto.categoria_id || ''
    })
  }

  const eliminarGasto = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar este gasto?")) return;
    try {
      await fetch(`${API_URL}/gastos/${id}`, { method: 'DELETE' })
      cargarGastos()
    } catch (error) {
      console.error("Error al eliminar:", error)
    }
  }

  useEffect(() => {
    cargarGastos()
  }, [])

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', fontFamily: 'system-ui', padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Mis Gastos 💸</h1>
        <button 
          onClick={sincronizarCorreos} 
          disabled={sincronizando}
          style={{ padding: '10px 15px', cursor: 'pointer', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          {sincronizando ? '🔄 Buscando...' : '🔄 Sincronizar Gmail'}
        </button>
      </header>

      {/* Formulario de Registro/Edición */}
      <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>{formData.id ? '✏️ Editar Gasto' : '➕ Agregar Gasto Manual'}</h3>
        <form onSubmit={guardarGasto} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input type="text" name="comercio" placeholder="Comercio" value={formData.comercio} onChange={manejarCambioInput} required style={{ padding: '8px' }} />
          <input type="number" step="0.01" name="monto" placeholder="Monto ($)" value={formData.monto} onChange={manejarCambioInput} required style={{ padding: '8px' }} />
          <input type="date" name="fecha_gasto" value={formData.fecha_gasto} onChange={manejarCambioInput} required style={{ padding: '8px' }} />
          <select name="categoria_id" value={formData.categoria_id} onChange={manejarCambioInput} style={{ padding: '8px' }}>
            <option value="">-- Sin Categoría --</option>
            {CATEGORIAS.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.nombre}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" style={{ flex: 1, padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}>
              {formData.id ? 'Actualizar' : 'Guardar'}
            </button>
            {formData.id && (
              <button type="button" onClick={() => setFormData({ id: null, monto: '', comercio: '', fecha_gasto: '', categoria_id: '' })} style={{ padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px' }}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {cargando ? (
        <p>Cargando datos...</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {gastos.map((gasto) => {
            const categoria = CATEGORIAS.find(c => c.id === gasto.categoria_id);
            return (
              <li key={gasto.id} style={{ borderBottom: '1px solid #eaeaea', padding: '15px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{gasto.comercio}</strong> {categoria && <span style={{ fontSize: '0.8rem', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '10px', marginLeft: '5px' }}>{categoria.nombre}</span>}
                  <br/>
                  <small style={{ color: '#666' }}>{new Date(gasto.fecha_gasto).toLocaleDateString()}</small>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                    ${gasto.monto}
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => editarGasto(gasto)} style={{ cursor: 'pointer', padding: '5px 8px', border: '1px solid #ccc', borderRadius: '3px', background: 'white' }}>✏️</button>
                    <button onClick={() => eliminarGasto(gasto.id)} style={{ cursor: 'pointer', padding: '5px 8px', border: '1px solid #ff4d4f', color: '#ff4d4f', borderRadius: '3px', background: 'white' }}>🗑️</button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default App
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const CATEGORIAS = [
  { id: 1, nombre: 'Alimentos y Bebidas' },
  { id: 2, nombre: 'Transporte' },
  { id: 3, nombre: 'Suscripciones y Software' },
  { id: 4, nombre: 'Apuestas y Juegos' },
  { id: 5, nombre: 'Entretenimiento' },
  { id: 6, nombre: 'Otros' }
];

function App() {
  // NUEVO ESTADO PARA LA SESIÓN
  const [session, setSession] = useState(null)
  
  const [gastos, setGastos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [formData, setFormData] = useState({ id: null, monto: '', comercio: '', fecha_gasto: '', categoria_id: '' })

  //  EFECTO DE AUTENTICACIÓN 
  useEffect(() => {
    //Revisar si ya hay una sesión guardada al abrir la página
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Escuchar cambios para cuando el usuario inicie o cierre sesión
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // cargarGastos solo se ejecute si hay sesión
  useEffect(() => {
    if (session) {
      cargarGastos()
    }
  }, [session])

  const cargarGastos = async () => {
    setCargando(true)
    try {
      // Más adelante aquí tengo que agregar el token de la sesión en los headers
      const respuesta = await fetch(`${API_URL}/gastos/`)
      const data = await respuesta.json()
      setGastos(data.gastos || [])
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

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
  }

  // RUTA PROTEGIDA (El "Cadenero")
  if (!session) {
    // Si no hay sesión, pantalla de bloqueo
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', fontFamily: 'system-ui', textAlign: 'center', padding: '20px', border: '1px solid #eaeaea', borderRadius: '10px' }}>
        <h2>🔒 Acceso Restringido</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>Debes iniciar sesión para gestionar tus gastos.</p>
        
        {/* Aquí insertaremos el componente de Login en el siguiente paso */}
        <div style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
          <p>[ Componente de Login en construcción 🛠️ ]</p>
        </div>
      </div>
    )
  }

  // RUTA PRINCIPAL
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', fontFamily: 'system-ui', padding: '20px' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Mis Gastos 💸</h1>
          {/* Botón para cerrar sesión */}
          <button onClick={cerrarSesion} style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', textDecoration: 'underline' }}>
            Cerrar sesión
          </button>
        </div>
        <button 
          onClick={sincronizarCorreos} 
          disabled={sincronizando}
          style={{ padding: '10px 15px', cursor: 'pointer', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          {sincronizando ? '🔄 Buscando...' : '🔄 Sincronizar Gmail'}
        </button>
      </header>

      {/* Aquí va el resto de tu interfaz (Formulario y Lista de gastos) exactamente igual */}
      <p>Bienvenido. Tu ID seguro es: <span style={{fontSize: '0.8rem', color: 'gray'}}>{session.user.id}</span></p>
      
    </div>
  )
}

export default App
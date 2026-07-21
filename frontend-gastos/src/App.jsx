import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabaseClient'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const CATEGORIAS = [
  { id: 1, nombre: 'Alimentos y Bebidas' },
  { id: 2, nombre: 'Transporte' },
  { id: 3, nombre: 'Suscripciones y Software' },
  { id: 4, nombre: 'Escuela' },
  { id: 5, nombre: 'Entretenimiento' },
  { id: 6, nombre: 'Otros' }
];

// Paleta de colores para las gráficas
const COLORES = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff6666'];

function App() {
  const [session, setSession] = useState(null)
  const [gastos, setGastos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [formData, setFormData] = useState({ id: null, monto: '', comercio: '', fecha_gasto: '', categoria_id: '' })

  const guardarCredenciales = async (session) => {
    if (session?.provider_token) {
      const tokenData = {
        access_token: session.provider_token,
        refresh_token: session.provider_refresh_token
      }
      await supabase.from('credenciales_google').upsert({
        usuario_id: session.user.id,
        token_data: tokenData,
        actualizado_en: new Date().toISOString()
      })
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      guardarCredenciales(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      guardarCredenciales(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      cargarGastos()
    }
  }, [session])

  const cargarGastos = async () => {
    setCargando(true)
    try {
      const respuesta = await fetch(`${API_URL}/gastos/`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const data = await respuesta.json()
      setGastos(data.gastos || [])
    } catch (error) {
      console.error("Error al cargar:", error)
    }
    setCargando(false)
  }

  const sincronizarCorreos = async () => {
    setSincronizando(true)
    try {
      const respuesta = await fetch(`${API_URL}/gastos/sincronizar`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const data = await respuesta.json()
      alert(data.mensaje + ` (${data.agregados} gastos nuevos)`)
      cargarGastos() 
    } catch (error) {
      console.error("Error al sincronizar:", error)
      alert("Hubo un error al sincronizar")
    }
    setSincronizando(false)
  }

  const manejarCambioInput = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const guardarGasto = async (e) => {
    e.preventDefault()
    const url = formData.id ? `${API_URL}/gastos/${formData.id}` : `${API_URL}/gastos/manual`
    const metodo = formData.id ? 'PUT' : 'POST'
    
    const bodyData = {
      monto: parseFloat(formData.monto),
      comercio: formData.comercio,
      fecha_gasto: formData.fecha_gasto,
      categoria_id: formData.categoria_id ? parseInt(formData.categoria_id) : null
    }

    try {
      await fetch(url, {
        method: metodo,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify(bodyData)
      })
      alert(`Gasto ${formData.id ? 'actualizado' : 'agregado'} con éxito`)
      setFormData({ id: null, monto: '', comercio: '', fecha_gasto: '', categoria_id: '' })
      cargarGastos()
    } catch (error) {
      console.error("Error al guardar:", error)
    }
  }

  const editarGasto = (gasto) => {
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
      await fetch(`${API_URL}/gastos/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` } 
      })
      cargarGastos()
    } catch (error) {
      console.error("Error al eliminar:", error)
    }
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
  }

  const iniciarSesionConGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: window.location.origin,
          scopes: 'https://www.googleapis.com/auth/gmail.readonly',
          queryParams: { access_type: 'offline', prompt: 'consent' }
        }
      })
      if (error) throw error
    } catch (error) {
      console.error("Error:", error)
    }
  }

  // LÓGICA DE GRÁFICAS
  
  // Datos para la gráfica de Pastel (Sumar por Categoría)
  const datosPastel = useMemo(() => {
    const agrupado = {};
    gastos.forEach(g => {
      const cat = CATEGORIAS.find(c => c.id === g.categoria_id)?.nombre || 'Otros';
      agrupado[cat] = (agrupado[cat] || 0) + parseFloat(g.monto);
    });
    // Convertir a un arreglo y ordenar de mayor a menor gasto
    return Object.keys(agrupado)
      .map(key => ({ name: key, value: agrupado[key] }))
      .sort((a, b) => b.value - a.value);
  }, [gastos]);

  // Datos para la gráfica de Barras (Sumar por Mes)
  const datosBarras = useMemo(() => {
    const agrupado = {};
    gastos.forEach(g => {
      // Extraemos solo el año y mes (Ej: "2026-07")
      const mes = g.fecha_gasto.substring(0, 7); 
      agrupado[mes] = (agrupado[mes] || 0) + parseFloat(g.monto);
    });
    // Convertir a un arreglo y ordenar cronológicamente
    return Object.keys(agrupado)
      .sort()
      .map(key => ({ mes: key, total: agrupado[key] }));
  }, [gastos]);


  // PANTALLAS
  
  if (!session) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', fontFamily: 'system-ui', textAlign: 'center', padding: '30px', border: '1px solid #eaeaea', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h2 style={{ marginBottom: '10px' }}>Bienvenido a Mis Gastos 💸</h2>
        <p style={{ color: '#666', marginBottom: '30px' }}>Inicia sesión de forma segura para gestionar tus finanzas.</p>
        <button onClick={iniciarSesionConGoogle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '12px', backgroundColor: 'white', color: '#333', border: '1px solid #ccc', borderRadius: '8px', fontSize: '1rem', fontWeight: '500', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continuar con Google
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui', padding: '20px' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Mis Gastos 💸</h1>
          <button onClick={cerrarSesion} style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', textDecoration: 'underline' }}>
            Cerrar sesión
          </button>
        </div>
        <button onClick={sincronizarCorreos} disabled={sincronizando} style={{ padding: '10px 15px', cursor: 'pointer', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px', width: 'fit-content' }}>
          {sincronizando ? '🔄 Buscando...' : '🔄 Sincronizar Gmail'}
        </button>
      </header>

      {/* ZONA DE DASHBOARD (GRÁFICAS) */}
      {!cargando && gastos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '30px' }}>
          
          {/* Gráfica de Pastel */}
          <div style={{ flex: '1 1 300px', backgroundColor: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #eaeaea', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <h3 style={{ textAlign: 'center', marginTop: 0, color: '#333' }}>Gastos por Categoría</h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={datosPastel} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                    {datosPastel.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfica de Barras */}
          <div style={{ flex: '1 1 300px', backgroundColor: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #eaeaea', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <h3 style={{ textAlign: 'center', marginTop: 0, color: '#333' }}>Tendencia Mensual</h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <BarChart data={datosBarras}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={(value) => `$${value}`} width={60} />
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Bar dataKey="total" fill="#0070f3" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      {/* FORMULARIO Y LISTA DE GASTOS */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', height: 'fit-content' }}>
          <h3 style={{marginTop: 0}}>{formData.id ? '✏️ Editar Gasto' : '➕ Agregar Gasto'}</h3>
          <form onSubmit={guardarGasto} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" name="comercio" placeholder="Comercio" value={formData.comercio} onChange={manejarCambioInput} required style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
            <input type="number" step="0.01" name="monto" placeholder="Monto ($)" value={formData.monto} onChange={manejarCambioInput} required style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
            <input type="date" name="fecha_gasto" value={formData.fecha_gasto} onChange={manejarCambioInput} required style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
            <select name="categoria_id" value={formData.categoria_id} onChange={manejarCambioInput} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
              <option value="">-- Sin Categoría --</option>
              {CATEGORIAS.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" style={{ flex: 1, padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                {formData.id ? 'Actualizar' : 'Guardar'}
              </button>
              {formData.id && (
                <button type="button" onClick={() => setFormData({ id: null, monto: '', comercio: '', fecha_gasto: '', categoria_id: '' })} style={{ padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        <div style={{ flex: '2 1 400px' }}>
          {cargando ? (
            <p>Cargando datos...</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {gastos.map((gasto) => {
                const categoria = CATEGORIAS.find(c => c.id === gasto.categoria_id);
                return (
                  <li key={gasto.id} style={{ borderBottom: '1px solid #eaeaea', padding: '15px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{gasto.comercio}</strong> 
                      {categoria && <span style={{ fontSize: '0.75rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '3px 8px', borderRadius: '12px', marginLeft: '8px', fontWeight: '500' }}>{categoria.nombre}</span>}
                      <br/>
                      <small style={{ color: '#888' }}>{new Date(gasto.fecha_gasto).toLocaleDateString()}</small>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#333' }}>${gasto.monto}</div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => editarGasto(gasto)} style={{ cursor: 'pointer', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white' }}>✏️</button>
                        <button onClick={() => eliminarGasto(gasto.id)} style={{ cursor: 'pointer', padding: '6px 10px', border: '1px solid #fee2e2', color: '#ef4444', borderRadius: '6px', background: '#fef2f2' }}>🗑️</button>
                      </div>
                    </div>
                  </li>
                )
              })}
              {gastos.length === 0 && <p style={{textAlign: 'center', color: '#666'}}>No hay gastos registrados. ¡Agrega uno o sincroniza tu correo!</p>}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
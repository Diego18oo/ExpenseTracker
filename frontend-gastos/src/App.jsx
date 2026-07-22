import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabaseClient'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const CATEGORIAS = [
  { id: 1, nombre: 'Alimentos y Bebidas', emoji: '🍔' },
  { id: 2, nombre: 'Transporte', emoji: '🚗' },
  { id: 3, nombre: 'Suscripciones y Software', emoji: '💻' },
  { id: 4, nombre: 'Escuela', emoji: '📚' },
  { id: 5, nombre: 'Entretenimiento', emoji: '🍿' },
  { id: 6, nombre: 'Otros', emoji: '📦' }
];

const COLORES = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

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

  // --- DATOS PARA GRÁFICAS ---
  const datosPastel = useMemo(() => {
    const agrupado = {};
    gastos.forEach(g => {
      const cat = CATEGORIAS.find(c => c.id === g.categoria_id)?.nombre || 'Otros';
      agrupado[cat] = (agrupado[cat] || 0) + parseFloat(g.monto);
    });
    return Object.keys(agrupado)
      .map(key => ({ name: key, value: agrupado[key] }))
      .sort((a, b) => b.value - a.value);
  }, [gastos]);

  const datosBarras = useMemo(() => {
    const agrupado = {};
    gastos.forEach(g => {
      const mes = g.fecha_gasto.substring(0, 7); 
      agrupado[mes] = (agrupado[mes] || 0) + parseFloat(g.monto);
    });
    return Object.keys(agrupado).sort().map(key => ({ mes: key, total: agrupado[key] }));
  }, [gastos]);

  const ultimosGastos = gastos.slice(0, 10);

  // --- ESTILOS COMPARTIDOS (MODO OSCURO) ---
  const bgApp = '#0f172a';
  const bgCard = '#1e293b';
  const borderDark = '#334155';
  const textMain = '#f8fafc';
  const textMuted = '#94a3b8';

  const cardStyle = { backgroundColor: bgCard, borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)', border: `1px solid ${borderDark}`, color: textMain };
  const inputStyle = { padding: '12px', backgroundColor: bgApp, color: textMain, border: `1px solid ${borderDark}`, borderRadius: '8px', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box', outline: 'none', colorScheme: 'dark' };
  const btnPrimary = { padding: '12px 20px', backgroundColor: '#3b82f6', color: textMain, border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s', width: '100%' };

  // ==========================================
  // PANTALLAS
  // ==========================================

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
        <div style={{ ...cardStyle, maxWidth: '400px', width: '90%', textAlign: 'center', padding: '40px 30px' }}>
          <h2 style={{ margin: '0 0 10px 0', color: textMain, fontSize: '1.8rem' }}>Expense Tracker 💸</h2>
          <p style={{ color: textMuted, marginBottom: '30px' }}>Inicia sesión de forma segura para gestionar tu dashboard financiero.</p>
          <button onClick={iniciarSesionConGoogle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', width: '100%', padding: '14px', backgroundColor: bgApp, color: textMain, border: `1px solid ${borderDark}`, borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', transition: 'border-color 0.2s' }}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: bgApp, padding: '30px 20px', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ margin: 0, color: textMain, fontSize: '2rem' }}>Expense Tracker 💸</h1>
            <p style={{ margin: '5px 0 0 0', color: textMuted }}>Monitorea y organiza tus gastos diarios.</p>
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <button onClick={sincronizarCorreos} disabled={sincronizando} style={{ ...btnPrimary, width: 'auto', backgroundColor: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {sincronizando ? '🔄 Buscando...' : '🔄 Sincronizar Santander'}
            </button>
            <button onClick={cerrarSesion} style={{ background: 'none', border: 'none', color: '#f87171', fontWeight: '500', cursor: 'pointer', padding: '10px' }}>
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* CONTENEDOR PRINCIPAL - 2 COLUMNAS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '30px', alignItems: 'start' }}>
          
          {/* PANEL IZQUIERDO: Operaciones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* Formulario */}
            <div style={cardStyle}>
              <h3 style={{ marginTop: 0, color: textMain, borderBottom: `1px solid ${borderDark}`, paddingBottom: '12px', marginBottom: '20px' }}>
                {formData.id ? '✏️ Editar Gasto' : '➕ Agregar Gasto Manual'}
              </h3>
              <form onSubmit={guardarGasto} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input type="text" name="comercio" placeholder="Nombre del Comercio" value={formData.comercio} onChange={manejarCambioInput} required style={inputStyle} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <input type="number" step="0.01" name="monto" placeholder="Monto ($)" value={formData.monto} onChange={manejarCambioInput} required style={inputStyle} />
                  <input type="date" name="fecha_gasto" value={formData.fecha_gasto} onChange={manejarCambioInput} required style={inputStyle} />
                </div>
                <select name="categoria_id" value={formData.categoria_id} onChange={manejarCambioInput} style={inputStyle}>
                  <option value="">-- Selecciona una Categoría --</option>
                  {CATEGORIAS.map(cat => <option key={cat.id} value={cat.id}>{cat.emoji} {cat.nombre}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                  <button type="submit" style={btnPrimary}>
                    {formData.id ? 'Actualizar Gasto' : 'Guardar Gasto'}
                  </button>
                  {formData.id && (
                    <button type="button" onClick={() => setFormData({ id: null, monto: '', comercio: '', fecha_gasto: '', categoria_id: '' })} style={{ ...btnPrimary, backgroundColor: '#475569' }}>
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Lista de últimos gastos */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${borderDark}`, paddingBottom: '12px', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: textMain }}>Últimos Movimientos</h3>
                <span style={{ fontSize: '0.85rem', color: '#cbd5e1', backgroundColor: '#334155', padding: '4px 8px', borderRadius: '12px' }}>Últimos 10</span>
              </div>
              
              {cargando ? (
                <p style={{ color: textMuted, textAlign: 'center', padding: '20px 0' }}>Cargando datos...</p>
              ) : ultimosGastos.length === 0 ? (
                <p style={{ color: textMuted, textAlign: 'center', padding: '20px 0' }}>No hay gastos registrados aún.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {ultimosGastos.map((gasto) => {
                    const categoria = CATEGORIAS.find(c => c.id === gasto.categoria_id);
                    return (
                      <li key={gasto.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: bgApp, borderRadius: '10px', border: `1px solid ${borderDark}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ fontSize: '1.5rem' }}>{categoria ? categoria.emoji : '💳'}</div>
                          <div>
                            <strong style={{ color: textMain, display: 'block', fontSize: '0.95rem' }}>{gasto.comercio}</strong>
                            <small style={{ color: textMuted }}>{new Date(gasto.fecha_gasto).toLocaleDateString()}</small>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: '700', color: textMain }}>${gasto.monto}</div>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button onClick={() => editarGasto(gasto)} style={{ cursor: 'pointer', padding: '6px', border: 'none', borderRadius: '6px', background: '#312e81', color: '#a5b4fc' }}>✏️</button>
                            <button onClick={() => eliminarGasto(gasto.id)} style={{ cursor: 'pointer', padding: '6px', border: 'none', borderRadius: '6px', background: '#7f1d1d', color: '#fca5a5' }}>🗑️</button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* PANEL DERECHO: Analíticas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* Gráfica de Pastel */}
            <div style={cardStyle}>
              <h3 style={{ marginTop: 0, color: textMain, borderBottom: `1px solid ${borderDark}`, paddingBottom: '12px', marginBottom: '20px' }}>Distribución de Gastos</h3>
              {gastos.length > 0 ? (
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={datosPastel} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} fill="#8884d8" paddingAngle={5}>
                        {datosPastel.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} stroke={bgCard} strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `$${value.toFixed(2)}`} contentStyle={{ backgroundColor: bgCard, borderColor: borderDark, color: textMain, borderRadius: '8px' }} itemStyle={{ color: textMain }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ color: textMain }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                 <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted }}>Sin datos suficientes</div>
              )}
            </div>

            {/* Gráfica de Barras */}
            <div style={cardStyle}>
              <h3 style={{ marginTop: 0, color: textMain, borderBottom: `1px solid ${borderDark}`, paddingBottom: '12px', marginBottom: '20px' }}>Tendencia Mensual</h3>
              {gastos.length > 0 ? (
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={datosBarras} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={borderDark} />
                      <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: textMuted, fontSize: 12 }} dy={10} />
                      <YAxis tickFormatter={(value) => `$${value}`} axisLine={false} tickLine={false} tick={{ fill: textMuted, fontSize: 12 }} />
                      <Tooltip formatter={(value) => `$${value.toFixed(2)}`} cursor={{ fill: borderDark }} contentStyle={{ backgroundColor: bgCard, borderColor: borderDark, color: textMain, borderRadius: '8px' }} itemStyle={{ color: textMain }} />
                      <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted }}>Sin datos suficientes</div>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  )
}

export default App
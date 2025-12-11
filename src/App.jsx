import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  CreditCard, 
  Calendar, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Eye, 
  EyeOff, 
  Copy, 
  LogOut, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

// Importaciones de Firebase
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  serverTimestamp,
  query, 
  orderBy 
} from 'firebase/firestore';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBg4JuYpPktFoaAHFeboc7mDHSvaGD9YKA",
  authDomain: "pixelbay-e4f08.firebaseapp.com",
  projectId: "pixelbay-e4f08",
  storageBucket: "pixelbay-e4f08.firebasestorage.app",
  messagingSenderId: "104379071554",
  appId: "1:104379071554:web:6389baec6797e2a38ec1db"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- COMPONENTES AUXILIARES ---

// Tarjeta de Estadística
const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
    <div className={`p-4 rounded-full ${color} bg-opacity-10`}>
      <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
    </div>
  </div>
);

// Badge de Estado
const StatusBadge = ({ daysLeft }) => {
  if (daysLeft < 0) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <XCircle className="w-3 h-3 mr-1" /> Vencido
      </span>
    );
  } else if (daysLeft <= 3) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <AlertTriangle className="w-3 h-3 mr-1" /> Por vencer ({daysLeft} días)
      </span>
    );
  } else {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" /> Activo ({daysLeft} días)
      </span>
    );
  }
};

// --- APLICACIÓN PRINCIPAL ---

export default function App() {
  const [user, setUser] = useState(null);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({}); // Controla qué contraseñas se ven
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    clientName: '',
    service: '',
    email: '',
    password: '',
    price: '',
    startDate: new Date().toISOString().split('T')[0],
    duration: '1', // Meses
  });

  // 1. Autenticación
useEffect(() => {
    signInAnonymously(auth).catch((error) => console.error(error));
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
}, []);
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Cargar Datos de Firestore
  useEffect(() => {
    if (!user) return;

    // Ruta segura: /artifacts/{appId}/users/{userId}/subscriptions
    const subsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'subscriptions');
    
    // No usamos orderBy complejo para evitar errores de índices, ordenamos en JS
    const unsubscribe = onSnapshot(subsCollection, (snapshot) => {
      const loadedSubs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Ordenar por fecha de vencimiento (calculada) o creación
      // Aquí ordenamos por fecha de creación descendente para ver los nuevos primero
      loadedSubs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      
      setSubs(loadedSubs);
      setLoading(false);
    }, (error) => {
      console.error("Error cargando suscripciones:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  // Lógica de fechas
  const calculateRenewalDate = (startStr, months) => {
    if (!startStr) return new Date();
    const date = new Date(startStr);
    date.setMonth(date.getMonth() + parseInt(months));
    return date;
  };

  const getDaysLeft = (renewalDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Resetear horas para comparación justa
    const renewal = new Date(renewalDate);
    renewal.setHours(0, 0, 0, 0);
    
    const diffTime = renewal - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays;
  };

  // Manejadores del CRUD
  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;

    const renewalDate = calculateRenewalDate(formData.startDate, formData.duration);
    
    const dataToSave = {
      ...formData,
      renewalDate: renewalDate.toISOString(),
      price: parseFloat(formData.price),
      duration: parseInt(formData.duration),
      updatedAt: serverTimestamp()
    };

    try {
      const collectionRef = collection(db, 'artifacts', appId, 'users', user.uid, 'subscriptions');
      
      if (editingId) {
        await updateDoc(doc(collectionRef, editingId), dataToSave);
      } else {
        await addDoc(collectionRef, {
          ...dataToSave,
          createdAt: serverTimestamp()
        });
      }
      setShowModal(false);
      setEditingId(null);
      resetForm();
    } catch (error) {
      console.error("Error guardando:", error);
      alert("Hubo un error al guardar.");
    }
  };

  const handleDelete = async (id) => {
    if (!user || !window.confirm("¿Seguro que quieres eliminar esta suscripción?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'subscriptions', id));
    } catch (error) {
      console.error("Error eliminando:", error);
    }
  };

  const handleEdit = (sub) => {
    setFormData({
      clientName: sub.clientName,
      service: sub.service,
      email: sub.email,
      password: sub.password,
      price: sub.price,
      startDate: sub.startDate,
      duration: sub.duration,
    });
    setEditingId(sub.id);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      clientName: '',
      service: '',
      email: '',
      password: '',
      price: '',
      startDate: new Date().toISOString().split('T')[0],
      duration: '1',
    });
    setEditingId(null);
  };

  const togglePassword = (id) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Podríamos mostrar un toast aquí
  };

  // Estadísticas y Filtrado
  const filteredSubs = useMemo(() => {
    return subs.filter(sub => 
      sub.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.service.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [subs, searchTerm]);

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let active = 0;
    let expiring = 0;
    
    subs.forEach(sub => {
      totalRevenue += sub.price || 0;
      const days = getDaysLeft(sub.renewalDate);
      if (days >= 0) active++;
      if (days >= 0 && days <= 5) expiring++;
    });

    return { totalRevenue, active, expiring };
  }, [subs]);

  // --- RENDERIZADO ---

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Gestor de Suscripciones</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-slate-500 hidden md:block">
            {user ? `Admin ID: ${user.uid.slice(0,6)}...` : 'Conectando...'}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard 
            title="Ingresos Mensuales" 
            value={`$${stats.totalRevenue.toFixed(2)}`} 
            icon={TrendingUp} 
            color="bg-emerald-500" 
          />
          <StatCard 
            title="Suscripciones Activas" 
            value={stats.active} 
            icon={CheckCircle} 
            color="bg-indigo-500" 
          />
          <StatCard 
            title="Por Vencer (5 días)" 
            value={stats.expiring} 
            icon={Clock} 
            color="bg-amber-500" 
          />
        </div>

        {/* Barra de Herramientas */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar cliente o servicio..."
              className="pl-10 w-full rounded-lg border-slate-300 border py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => { resetForm(); setShowModal(true); }}
            className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg flex items-center justify-center space-x-2 font-medium shadow-md transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Nueva Suscripción</span>
          </button>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente / Servicio</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Credenciales</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado / Vencimiento</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Precio</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredSubs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                      No se encontraron suscripciones. ¡Agrega la primera!
                    </td>
                  </tr>
                ) : (
                  filteredSubs.map((sub) => {
                    const daysLeft = getDaysLeft(sub.renewalDate);
                    return (
                      <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                              {sub.service.charAt(0).toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-bold text-slate-900">{sub.clientName}</div>
                              <div className="text-sm text-slate-500">{sub.service}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            {/* Email Row */}
                            <div className="flex items-center space-x-2 text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded max-w-fit">
                              <span className="truncate max-w-[150px]">{sub.email}</span>
                              <button onClick={() => copyToClipboard(sub.email)} className="text-slate-400 hover:text-indigo-600" title="Copiar Email">
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                            {/* Password Row */}
                            <div className="flex items-center space-x-2 text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded max-w-fit">
                              <span className="font-mono">
                                {visiblePasswords[sub.id] ? sub.password : '••••••••'}
                              </span>
                              <button onClick={() => togglePassword(sub.id)} className="text-slate-400 hover:text-indigo-600">
                                {visiblePasswords[sub.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                              <button onClick={() => copyToClipboard(sub.password)} className="text-slate-400 hover:text-indigo-600" title="Copiar Password">
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col items-start space-y-1">
                            <StatusBadge daysLeft={daysLeft} />
                            <span className="text-xs text-slate-500 ml-1">
                              Vence: {new Date(sub.renewalDate).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          ${sub.price}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={() => handleEdit(sub)} className="text-indigo-600 hover:text-indigo-900 mr-4 p-2 hover:bg-indigo-50 rounded-full transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(sub.id)} className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-full transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal Formulario */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">
                {editingId ? 'Editar Suscripción' : 'Nueva Suscripción'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-indigo-200 hover:text-white transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Cliente</label>
                  <input
                    required
                    type="text"
                    className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ej. Juan Pérez"
                    value={formData.clientName}
                    onChange={e => setFormData({...formData, clientName: e.target.value})}
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Servicio / Producto</label>
                  <input
                    required
                    type="text"
                    className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ej. Netflix 4K"
                    value={formData.service}
                    onChange={e => setFormData({...formData, service: e.target.value})}
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio ($)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: e.target.value})}
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Compra</label>
                  <input
                    required
                    type="date"
                    className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formData.startDate}
                    onChange={e => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duración (Meses)</label>
                  <select
                    className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    value={formData.duration}
                    onChange={e => setFormData({...formData, duration: e.target.value})}
                  >
                    {[1, 2, 3, 6, 12].map(m => (
                      <option key={m} value={m}>{m} {m === 1 ? 'Mes' : 'Meses'}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Datos de Acceso (Credenciales)</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Correo de la Cuenta</label>
                      <input
                        required
                        type="email"
                        className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                        placeholder="usuario@servicio.com"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                      <input
                        required
                        type="text"
                        className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                        placeholder="Contraseña del servicio"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md transition-colors"
                >
                  {editingId ? 'Actualizar' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect, useMemo } from 'react';
import { Users, Plus, Search, Trash2, Edit2, Eye, EyeOff, Copy, TrendingUp, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';

// --- PEGA AQUÍ TUS DATOS DE FIREBASE ---
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
const appId = "panel-produccion-01"; 

// Componentes Visuales Bootstrap
const StatCard = ({ title, value, icon: Icon, bgClass, textClass }) => (
  <div className="col-md-4 mb-3">
    <div className="card h-100 shadow-sm border-0">
      <div className="card-body d-flex align-items-center">
        <div className={`rounded-circle p-3 me-3 ${bgClass} bg-opacity-10`}>
          <Icon size={24} className={textClass} />
        </div>
        <div>
          <h6 className="text-muted mb-0 small">{title}</h6>
          <h3 className="fw-bold mb-0">{value}</h3>
        </div>
      </div>
    </div>
  </div>
);

const StatusBadge = ({ daysLeft }) => {
  if (daysLeft < 0) return <span className="badge bg-danger">Vencido</span>;
  if (daysLeft <= 3) return <span className="badge bg-warning text-dark">Por vencer ({daysLeft}d)</span>;
  return <span className="badge bg-success">Activo ({daysLeft}d)</span>;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  
  const [formData, setFormData] = useState({
    clientName: '', service: '', email: '', password: '', price: '', startDate: new Date().toISOString().split('T')[0], duration: '1',
  });

  useEffect(() => {
    signInAnonymously(auth).catch((e) => console.error(e));
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'subscriptions'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSubs(data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    const renewal = new Date(formData.startDate);
    renewal.setMonth(renewal.getMonth() + parseInt(formData.duration));
    
    const data = { ...formData, renewalDate: renewal.toISOString(), price: parseFloat(formData.price), duration: parseInt(formData.duration), updatedAt: serverTimestamp() };
    const ref = collection(db, 'artifacts', appId, 'users', user.uid, 'subscriptions');
    
    try {
      if (editingId) await updateDoc(doc(ref, editingId), data);
      else await addDoc(ref, { ...data, createdAt: serverTimestamp() });
      setShowModal(false); resetForm();
    } catch (err) { alert("Error al guardar"); }
  };

  const handleDelete = async (id) => {
    if (confirm("¿Eliminar?")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'subscriptions', id));
  };

  const resetForm = () => {
    setFormData({ clientName: '', service: '', email: '', password: '', price: '', startDate: new Date().toISOString().split('T')[0], duration: '1' });
    setEditingId(null);
  };

  const stats = useMemo(() => {
    let rev = 0, act = 0, exp = 0;
    subs.forEach(s => {
      rev += s.price || 0;
      const days = Math.ceil((new Date(s.renewalDate) - new Date()) / (1000 * 60 * 60 * 24));
      if (days >= 0) act++;
      if (days >= 0 && days <= 5) exp++;
    });
    return { rev, act, exp };
  }, [subs]);

  const filtered = subs.filter(s => s.clientName.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div className="d-flex justify-content-center mt-5"><div className="spinner-border text-primary"/></div>;

  return (
    <div className="bg-light min-vh-100 pb-5">
      <nav className="navbar navbar-dark bg-primary mb-4 shadow-sm">
        <div className="container">
          <span className="navbar-brand fw-bold"><Users className="me-2"/> Gestor de Suscripciones</span>
          <span className="text-white-50 small">{user ? `ID: ${user.uid.slice(0,4)}...` : '...'}</span>
        </div>
      </nav>

      <div className="container">
        <div className="row mb-4">
          <StatCard title="Ingresos" value={`$${stats.rev}`} icon={TrendingUp} bgClass="bg-success" textClass="text-success" />
          <StatCard title="Activos" value={stats.act} icon={CheckCircle} bgClass="bg-primary" textClass="text-primary" />
          <StatCard title="Por Vencer" value={stats.exp} icon={Clock} bgClass="bg-warning" textClass="text-warning" />
        </div>

        <div className="d-flex justify-content-between mb-3 gap-2">
          <input className="form-control" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{maxWidth: '300px'}} />
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}><Plus size={18} className="me-1"/> Nuevo</button>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light"><tr><th className="ps-3">Cliente</th><th>Credenciales</th><th>Estado</th><th>Precio</th><th className="text-end pe-3">Acciones</th></tr></thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td className="ps-3">
                      <div className="fw-bold">{s.clientName}</div><small className="text-muted">{s.service}</small>
                    </td>
                    <td>
                      <div className="d-flex flex-column small">
                        <span className="text-muted">{s.email}</span>
                        <div className="d-flex align-items-center gap-2">
                          <span className="font-monospace">{visiblePasswords[s.id] ? s.password : '••••'}</span>
                          <Eye size={12} style={{cursor:'pointer'}} onClick={() => setVisiblePasswords(p => ({...p, [s.id]: !p[s.id]}))} />
                        </div>
                      </div>
                    </td>
                    <td><StatusBadge daysLeft={Math.ceil((new Date(s.renewalDate) - new Date()) / (86400000))} /></td>
                    <td className="fw-bold">${s.price}</td>
                    <td className="text-end pe-3">
                      <button className="btn btn-sm btn-light text-primary me-1" onClick={() => {setFormData(s); setEditingId(s.id); setShowModal(true);}}><Edit2 size={14}/></button>
                      <button className="btn btn-sm btn-light text-danger" onClick={() => handleDelete(s.id)}><Trash2 size={14}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal show d-block" style={{background: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">{editingId ? 'Editar' : 'Nuevo'}</h5>
                <button className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleSave}>
                  <div className="mb-2"><label>Cliente</label><input className="form-control" required value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} /></div>
                  <div className="row g-2 mb-2">
                    <div className="col"><label>Servicio</label><input className="form-control" required value={formData.service} onChange={e => setFormData({...formData, service: e.target.value})} /></div>
                    <div className="col"><label>Precio</label><input type="number" step="0.01" className="form-control" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} /></div>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col"><label>Inicio</label><input type="date" className="form-control" required value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} /></div>
                    <div className="col"><label>Meses</label><select className="form-select" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})}>{[1,3,6,12].map(m=><option key={m} value={m}>{m}</option>)}</select></div>
                  </div>
                  <hr/>
                  <div className="mb-2"><label>Email</label><input type="email" className="form-control" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                  <div className="mb-3"><label>Password</label><input className="form-control" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
                  <div className="text-end"><button type="button" className="btn btn-secondary me-2" onClick={() => setShowModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Guardar</button></div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

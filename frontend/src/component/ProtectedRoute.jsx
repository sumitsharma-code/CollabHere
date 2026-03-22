import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="spinner-wrapper" style={{ height: '100vh' }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;
    return children;
}

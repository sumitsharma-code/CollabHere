import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check if user is already logged in on mount
    useEffect(() => {
        fetch('/api/auth/me', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.user) setUser(data.user);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    async function login(identifier, password) {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username: identifier, email: identifier, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Login failed');
        // Fetch user info after login
        const meRes = await fetch('/api/auth/me', { credentials: 'include' });
        const meData = await meRes.json();
        setUser(meData.user);
        return meData.user;
    }

    async function register(username, email, password) {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Registration failed');
        const meRes = await fetch('/api/auth/me', { credentials: 'include' });
        const meData = await meRes.json();
        setUser(meData.user);
        return meData.user;
    }

    async function logout() {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

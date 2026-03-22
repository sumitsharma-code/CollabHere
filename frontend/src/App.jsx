import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./component/ProtectedRoute";

import Login     from "./pages/Login";
import Register  from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Workspace from "./pages/Workspace";
import Editor    from "./pages/Editor";

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    {/* Public routes */}
                    <Route path="/login"    element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    {/* Protected routes */}
                    <Route path="/dashboard" element={
                        <ProtectedRoute><Dashboard /></ProtectedRoute>
                    } />
                    <Route path="/workspace/:workspaceId" element={
                        <ProtectedRoute><Workspace /></ProtectedRoute>
                    } />
                    {/* ✅ FIX: Route now includes workspaceId so Editor can fetch the document */}
                    <Route path="/workspace/:workspaceId/editor/:documentId" element={
                        <ProtectedRoute><Editor /></ProtectedRoute>
                    } />

                    {/* Default redirect */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
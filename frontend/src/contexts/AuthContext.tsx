import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.js';
import { authApi } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginDemo: (email?: string, name?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('reachinbox_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('reachinbox_token');
      const storedUser = localStorage.getItem('reachinbox_user');

      if (storedToken && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
          // Verify with backend
          const res = await authApi.getMe();
          if (res.user) {
            setUser(res.user);
            localStorage.setItem('reachinbox_user', JSON.stringify(res.user));
          }
        } catch (err) {
          console.warn('Session verification failed, logging out');
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const loginWithGoogle = async (credential: string) => {
    setLoading(true);
    try {
      const res = await authApi.loginWithGoogle(credential);
      setUser(res.user);
      setToken(res.token);
      localStorage.setItem('reachinbox_token', res.token);
      localStorage.setItem('reachinbox_user', JSON.stringify(res.user));
    } finally {
      setLoading(false);
    }
  };

  const loginDemo = async (email?: string, name?: string) => {
    setLoading(true);
    try {
      const res = await authApi.loginDemo(email, name);
      setUser(res.user);
      setToken(res.token);
      localStorage.setItem('reachinbox_token', res.token);
      localStorage.setItem('reachinbox_user', JSON.stringify(res.user));
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('reachinbox_token');
    localStorage.removeItem('reachinbox_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, loginWithGoogle, loginDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

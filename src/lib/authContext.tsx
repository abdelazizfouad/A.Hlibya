import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, Branch } from '../types/erp';
import { INITIAL_DEMO_USERS, INITIAL_BRANCHES } from './seedData';

interface AuthContextType {
  currentUser: UserProfile | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  activeBranch: Branch;
  allBranches: Branch[];
  login: (usernameOrEmail: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchBranch: (branchId: string) => void;
  // Role permission helpers
  isSuperAdmin: boolean;
  canEditParts: boolean;
  canPerformStockMovements: boolean;
  canAdjustStockDirectly: boolean;
  canViewFinancials: boolean;
  canManageWarehouseLocations: boolean;
  canAccessAuditLogs: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('ahl_active_user');
    const token = localStorage.getItem('ahl_auth_token');
    if (saved && token) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const token = localStorage.getItem('ahl_auth_token');
    const authStatus = localStorage.getItem('ahl_is_authenticated');
    return Boolean(token && authStatus === 'true');
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [activeBranch, setActiveBranch] = useState<Branch>(() => {
    const saved = localStorage.getItem('ahl_active_branch');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_BRANCHES[0];
  });

  // Verify backend session token on app startup / refresh
  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem('ahl_auth_token');

    if (!token) {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setIsLoading(false);
      return;
    }

    const verifyBackendSession = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user && isMounted) {
            setCurrentUser(data.user);
            setIsAuthenticated(true);
            localStorage.setItem('ahl_active_user', JSON.stringify(data.user));
            localStorage.setItem('ahl_is_authenticated', 'true');
          } else if (isMounted) {
            // Token rejected
            handleClearSession();
          }
        } else if (response.status === 401 && isMounted) {
          handleClearSession();
        }
      } catch (err) {
        console.warn('Backend verify check offline/network notice, using local valid session if exists:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    verifyBackendSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleClearSession = () => {
    localStorage.removeItem('ahl_auth_token');
    localStorage.removeItem('ahl_active_user');
    localStorage.setItem('ahl_is_authenticated', 'false');
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const login = async (usernameOrEmail: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanUser = usernameOrEmail.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      return { success: false, error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' };
    }

    try {
      // 1. Authenticate with backend API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: cleanUser,
          password: cleanPass
        })
      });

      const data = await response.json();

      if (response.ok && data.success && data.token) {
        // Save secure session token
        localStorage.setItem('ahl_auth_token', data.token);
        localStorage.setItem('ahl_active_user', JSON.stringify(data.user));
        localStorage.setItem('ahl_is_authenticated', 'true');

        setCurrentUser(data.user);
        setIsAuthenticated(true);

        return { success: true };
      } else {
        return {
          success: false,
          error: data.error || 'بيانات الدخول غير صحيحة. يرجى التأكد من البريد الإلكتروني وكلمة المرور.'
        };
      }
    } catch (err: any) {
      console.warn('Network call failed, performing secure local auth verification:', err);

      // Local fallback for offline mode
      const normalizedUser = cleanUser.toLowerCase();
      const isMatch = (
        normalizedUser === 'admin@ahlibya.store' || 
        normalizedUser === 'admin' || 
        normalizedUser === 'عبد العزيز' ||
        normalizedUser === 'abdulaziz'
      ) && cleanPass === '12345';

      if (isMatch) {
        const adminUser = INITIAL_DEMO_USERS[0];
        const offlineToken = `ahl_local_${Date.now()}`;

        localStorage.setItem('ahl_auth_token', offlineToken);
        localStorage.setItem('ahl_active_user', JSON.stringify(adminUser));
        localStorage.setItem('ahl_is_authenticated', 'true');

        setCurrentUser(adminUser);
        setIsAuthenticated(true);

        return { success: true };
      }

      return { 
        success: false, 
        error: 'بيانات الدخول غير صحيحة. البريد الإلكتروني: admin@ahlibya.store أو ADMIN وكلمة المرور: 12345' 
      };
    }
  };

  const logout = async (): Promise<void> => {
    const token = localStorage.getItem('ahl_auth_token');

    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (e) {
      console.warn('Logout notification error:', e);
    } finally {
      handleClearSession();
    }
  };

  const switchBranch = (branchId: string) => {
    const found = INITIAL_BRANCHES.find(b => b.id === branchId);
    if (found) {
      setActiveBranch(found);
      localStorage.setItem('ahl_active_branch', JSON.stringify(found));
    }
  };

  // Role permissions for Super Admin Abdulaziz
  const role = currentUser?.role || 'SUPER_ADMIN';

  const isSuperAdmin = isAuthenticated && role === 'SUPER_ADMIN';
  const canEditParts = isAuthenticated && ['SUPER_ADMIN', 'MANAGER', 'WAREHOUSE', 'PURCHASING'].includes(role);
  const canPerformStockMovements = isAuthenticated && ['SUPER_ADMIN', 'MANAGER', 'WAREHOUSE', 'PURCHASING', 'SALES'].includes(role);
  const canAdjustStockDirectly = isAuthenticated && ['SUPER_ADMIN', 'MANAGER', 'WAREHOUSE'].includes(role);
  const canViewFinancials = isAuthenticated && ['SUPER_ADMIN', 'MANAGER', 'PURCHASING', 'ACCOUNTING'].includes(role);
  const canManageWarehouseLocations = isAuthenticated && ['SUPER_ADMIN', 'MANAGER', 'WAREHOUSE'].includes(role);
  const canAccessAuditLogs = isAuthenticated && ['SUPER_ADMIN', 'MANAGER'].includes(role);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        user: currentUser,
        isAuthenticated,
        isLoading,
        activeBranch,
        allBranches: INITIAL_BRANCHES,
        login,
        logout,
        switchBranch,
        isSuperAdmin,
        canEditParts,
        canPerformStockMovements,
        canAdjustStockDirectly,
        canViewFinancials,
        canManageWarehouseLocations,
        canAccessAuditLogs
      }}
    >
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

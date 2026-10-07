import { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

/**
 * Manager id for SoftAP configure + GET /api/device/by-manager/:id/*.
 *
 * - manager → own user id
 * - user (sub-user) → org.owner / creatorId — NEVER the sub-user's own id
 */
export function useManagerId() {
  const { user } = useAuth();
  const { role, dashboardOrgs: orgs } = useAppContext();

  return useMemo(() => {
    if (role === 'manager' || role === 'admin') {
      return user?.id || '';
    }
    
    const fromOrg = (orgs || []).map((o) => o?.managerId).find(Boolean);
    if (fromOrg) return String(fromOrg);
    
    if (user?.creatorId) return String(user.creatorId);

    return '';
  }, [role, orgs, user?.id, user?.creatorId]);
}

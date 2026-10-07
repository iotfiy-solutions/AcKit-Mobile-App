import axios from 'axios';
import api from './axios';

/**
 * POST /api/auth/register-user — manager creates a sub-user.
 * Backend emails an OTP; user verifies then sets password.
 */
export async function createSubUser({ name, email, organizations, venues }) {
  const { data } = await api.post('/api/auth/register-user', {
    name,
    email,
    role: 'user',
    organizations,
    venues: venues || [],
  });

  return {
    id: String(data.user.id),
    name: data.user.name,
    email: data.user.email,
    status: 'pending',
    assignedVenueIds: venues || [],
    organizationIds: organizations,
    managerId: '',
  };
}

function mapVenueId(entry) {
  const venueId = entry?.venueId;
  if (!venueId) return null;
  if (typeof venueId === 'string') return venueId;
  return venueId._id ? String(venueId._id) : null;
}

function mapOrgId(org) {
  return typeof org === 'string' ? org : String(org._id);
}

/** Map API sub-user → app UserAccount shape. */
export function mapApiSubUser(user) {
  const creator = user.creatorId;
  const managerId =
    typeof creator === 'string'
      ? creator
      : creator?._id
        ? String(creator._id)
        : '';

  const assignedVenueIds = (user.venues || [])
    .map((venue) => mapVenueId(venue))
    .filter(Boolean);

  const organizationIds = (user.organizations || []).map(mapOrgId);

  let status = 'pending';
  if (user.isVerified) {
    status = user.isActive ? 'active' : 'inactive';
  }

  return {
    id: String(user._id || user.id),
    name: user.name,
    email: user.email,
    status,
    assignedVenueIds,
    organizationIds,
    managerId,
  };
}

/** GET /api/user/manager/:managerId */
export async function getUsersByManager(managerId) {
  if (!managerId) return [];
  try {
    const { data } = await api.get(`/api/user/manager/${managerId}`);
    return (data.subUsers || []).map(mapApiSubUser);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return [];
    }
    throw err;
  }
}

/** PUT /api/user/update-user/:userId — orgs + venues only. */
export async function updateSubUser(userId, { organizations, venues }) {
  const { data } = await api.put(`/api/user/update-user/${userId}`, {
    organizations,
    venues: venues || [],
  });
  return mapApiSubUser(data.user);
}

/** DELETE /api/user/delete-user/:userId */
export async function deleteSubUser(userId) {
  await api.delete(`/api/user/delete-user/${userId}`);
}

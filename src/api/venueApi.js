import api from './axios';

/** Mirrors ackitFrontend/src/api/venueApi.ts */
export function mapApiVenue(venue) {
  const organization = venue.organization;
  const orgId =
    typeof organization === 'string'
      ? organization
      : organization?._id
        ? String(organization._id)
        : '';

  return {
    id: String(venue._id || venue.id),
    name: venue.name,
    orgId,
    orgName: typeof organization === 'object' ? organization?.name : undefined,
  };
}

function isEmptyNotFound(err) {
  const status = err?.response?.status;
  const message = String(err?.response?.data?.message || '').toLowerCase();
  return status === 404 && message.includes('venue');
}

export async function getVenuesByOrganization(organizationId) {
  try {
    const { data } = await api.get(`/api/venue/get-by-org/${organizationId}`);
    return (data.venues || []).map(mapApiVenue);
  } catch (err) {
    if (isEmptyNotFound(err)) return [];
    throw err;
  }
}

export async function getMyVenues(organizationIds) {
  if (!organizationIds?.length) return [];
  const batches = await Promise.all(
    organizationIds.map((orgId) => getVenuesByOrganization(orgId))
  );
  return batches.flat();
}

/** POST /api/venue/create — { name, organization } */
export async function createVenue(name, organizationId) {
  const { data } = await api.post('/api/venue/create', {
    name,
    organization: organizationId,
  });
  return mapApiVenue(data.venue);
}

/** PUT /api/venue/update/:id — { name?, organization? } */
export async function updateVenue(id, { name, organizationId } = {}) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (organizationId !== undefined) body.organization = organizationId;

  const { data } = await api.put(`/api/venue/update/${id}`, body);
  return mapApiVenue(data.venue);
}

/** DELETE /api/venue/delete-venue/:id */
export async function deleteVenue(id) {
  await api.delete(`/api/venue/delete-venue/${id}`);
}

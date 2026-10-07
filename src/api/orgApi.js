import api from './axios';

/** Mirrors ackitFrontend/src/api/orgApi.ts */
export function mapApiOrganization(org) {
  const owner = org.owner;
  const managerId =
    typeof owner === 'string'
      ? owner
      : owner?._id
        ? String(owner._id)
        : '';

  return {
    id: String(org._id || org.id),
    name: org.name,
    managerId,
    address: org.address || undefined,
    ownerName: typeof owner === 'object' ? owner?.name : undefined,
    ownerEmail: typeof owner === 'object' ? owner?.email : undefined,
  };
}

export async function getMyOrganizations() {
  const { data } = await api.get('/api/organization/my-organizations');
  return (data.organizations || []).map(mapApiOrganization);
}

/** POST /api/organization/create — { name, address? } */
export async function createOrganization(name, address) {
  const payload = { name };
  if (address?.trim()) payload.address = address.trim();

  const { data } = await api.post('/api/organization/create', payload);
  return mapApiOrganization(data.organization);
}

/** PUT /api/organization/update/:id — { name, address } */
export async function updateOrganization(id, name, address) {
  const { data } = await api.put(`/api/organization/update/${id}`, {
    name,
    address: address ?? '',
  });
  const org = data.organization;
  return {
    id: String(org.id || org._id),
    name: org.name,
    managerId: String(org.owner || ''),
    address: org.address || undefined,
  };
}

/** DELETE /api/organization/delete-org/:id */
export async function deleteOrganization(id) {
  await api.delete(`/api/organization/delete-org/${id}`);
}
"use server";

import { platformRequest } from "../../lib/platform-api";

export async function updatePlanAction(input: Record<string, unknown>) {
  const planCode = String(input.plan_code ?? "").trim();
  if (!planCode) {
    throw new Error("Plan code wajib diisi.");
  }

  return platformRequest(`/api/v1/platform/plans/${planCode}`, {
    method: "PUT",
    body: input,
  });
}

export async function updateTenantPlanAction(input: Record<string, unknown>) {
  const tenantID = String(input.tenant_id ?? "").trim();
  if (!tenantID) {
    throw new Error("Tenant ID wajib diisi.");
  }

  return platformRequest(`/api/v1/platform/tenants/${tenantID}/plan`, {
    method: "POST",
    body: input,
  });
}

export async function updateTenantStatusAction(input: Record<string, unknown>) {
  const tenantID = String(input.tenant_id ?? "").trim();
  if (!tenantID) {
    throw new Error("Tenant ID wajib diisi.");
  }

  return platformRequest(`/api/v1/platform/tenants/${tenantID}/status`, {
    method: "POST",
    body: input,
  });
}

export async function createPlatformResourceAction(resourceType: string, input: Record<string, unknown>) {
  return platformRequest(`/api/v1/platform/resources/${resourceType}`, {
    method: "POST",
    body: input,
  });
}

export async function updatePlatformResourceAction(
  resourceType: string,
  itemID: string,
  input: Record<string, unknown>,
) {
  return platformRequest(`/api/v1/platform/resources/${resourceType}/${itemID}`, {
    method: "PUT",
    body: input,
  });
}

export async function deletePlatformResourceAction(resourceType: string, itemID: string) {
  return platformRequest(`/api/v1/platform/resources/${resourceType}/${itemID}`, {
    method: "DELETE",
  });
}

export async function updatePlatformConfigAction(configType: string, config: Record<string, unknown>) {
  return platformRequest(`/api/v1/platform/config/${configType}`, {
    method: "PUT",
    body: { config },
  });
}

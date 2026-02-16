import { Platform } from 'react-native';
import type { DesignState, SavedDesign } from '../types/design';
import type {
  CatalogModel,
  CreateDesignRequest,
  DesignRecordDTO,
  ListDesignsResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  UserProfile,
} from '../types/api';
import { toSavedDesign } from '../types/api';

type RequestMethod = 'GET' | 'POST' | 'PUT';

type ApiErrorPayload = {
  error?: string;
};

const DEFAULT_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<TResponse>(
  path: string,
  method: RequestMethod,
  body?: unknown,
  token?: string,
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    method,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as ApiErrorPayload;
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Ignore parse errors.
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as TResponse;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export async function registerUser(input: RegisterRequest): Promise<RegisterResponse> {
  return request<RegisterResponse>('/auth/register', 'POST', input);
}

export async function loginUser(input: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', 'POST', input);
}

export async function fetchMe(token: string): Promise<UserProfile> {
  return request<UserProfile>('/me', 'GET', undefined, token);
}

export async function fetchCatalogModel(): Promise<CatalogModel> {
  return request<CatalogModel>('/catalog/model', 'GET');
}

export async function listDesigns(token: string): Promise<SavedDesign[]> {
  const payload = await request<ListDesignsResponse>('/designs', 'GET', undefined, token);
  return payload.designs.map(toSavedDesign);
}

export async function createDesign(
  token: string,
  input: {
    materials: DesignState;
    name: string;
  },
): Promise<SavedDesign> {
  const payload: CreateDesignRequest = {
    name: input.name,
    selections: input.materials,
  };
  const response = await request<DesignRecordDTO>('/designs', 'POST', payload, token);
  return toSavedDesign(response);
}

export async function updateDesign(
  token: string,
  designID: string,
  input: {
    materials: DesignState;
    name: string;
  },
): Promise<SavedDesign> {
  const payload: CreateDesignRequest = {
    name: input.name,
    selections: input.materials,
  };
  const response = await request<DesignRecordDTO>(`/designs/${designID}`, 'PUT', payload, token);
  return toSavedDesign(response);
}

import { getAuthToken } from './hooks/useAuth'

export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken()
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  })

  if (!res.ok) {
    let message = 'Something went wrong.'
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}

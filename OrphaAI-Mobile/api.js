import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE = "https://orphaai-backend.onrender.com/api/v1";

export async function getAccessToken() {
  return AsyncStorage.getItem("accessToken");
}

export async function clearSession(navigation) {
  await AsyncStorage.multiRemove(["accessToken", "userName"]);
  if (navigation) navigation.reset({ index: 0, routes: [{ name: "Login" }] });
}

export async function apiRequest(path, options = {}, navigation) {
  const token = await getAccessToken();
  if (!token && options.protected !== false) {
    await clearSession(navigation);
    throw new Error("Please log in again.");
  }

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    await clearSession(navigation);
    throw new Error("Session expired. Please log in again.");
  }
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload.data || payload;
}

export function displayName(user) {
  if (!user) return "Dr. Demo Researcher";
  const name = `${user.firstName || user.first_name || ""} ${user.lastName || user.last_name || ""}`.trim();
  return name ? `Dr. ${name.replace(/^Dr\.\s*/i, "")}` : user.email || "Dr. Demo Researcher";
}

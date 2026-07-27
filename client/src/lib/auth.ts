import { useQuery } from "@tanstack/react-query";

type AuthUser = {
  id: string;
  displayName: string;
  email: string;
  photo?: string;
};

type AuthMeResponse = {
  authenticated: boolean;
  user?: AuthUser;
};

export function useAuth() {
  const query = useQuery<AuthMeResponse>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (res.status === 401) {
        return { authenticated: false };
      }

      if (!res.ok) {
        throw new Error("Failed to load auth session");
      }

      return (await res.json()) as AuthMeResponse;
    },
    retry: false,
    staleTime: 30 * 1000,
  });

  return {
    ...query,
    isAuthenticated: Boolean(query.data?.authenticated),
    user: query.data?.user,
  };
}

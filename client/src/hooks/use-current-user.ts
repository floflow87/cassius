import { useQuery } from "@tanstack/react-query";

export interface CurrentUser {
  id: string;
  username: string;
  nom: string | null;
  prenom: string | null;
  role: "ADMIN" | "CHIRURGIEN" | "ASSISTANT";
  organisationId: string | null;
  organisationNom?: string;
  wasInvited?: boolean;
}

export function useCurrentUser() {
  const { data: user, isLoading, error } = useQuery<CurrentUser>({
    queryKey: ["/api/settings/profile"],
    staleTime: 5 * 60 * 1000,
  });

  const isAdmin = user?.role === "ADMIN";
  const isChirurgien = user?.role === "CHIRURGIEN";
  const isAssistant = user?.role === "ASSISTANT";
  const canDelete = user?.role === "ADMIN" || user?.role === "CHIRURGIEN";
  const canEdit = user?.role === "ADMIN" || user?.role === "CHIRURGIEN";

  return {
    user,
    isLoading,
    error,
    isAdmin,
    isChirurgien,
    isAssistant,
    canDelete,
    canEdit,
  };
}

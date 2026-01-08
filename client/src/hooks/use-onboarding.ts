import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { OnboardingData } from "@shared/schema";

interface OnboardingStateResponse {
  id: string;
  organisationId: string;
  currentStep: number;
  completedSteps: Record<string, boolean>;
  skippedSteps: Record<string, boolean>;
  data: OnboardingData;
  status: "IN_PROGRESS" | "COMPLETED";
  completedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

interface PatchOnboardingParams {
  currentStep?: number;
  markCompleteStep?: number;
  markSkipStep?: number;
  dataPatch?: Partial<OnboardingData>;
}

export const ONBOARDING_STEPS = [
  { id: 0, title: "Bienvenue", description: "Configurez votre profil", required: true },
  { id: 1, title: "Clinique & sécurité", description: "Informations de votre cabinet", required: true },
  { id: 2, title: "Équipe & rôles", description: "Invitez vos collaborateurs", required: false },
  { id: 3, title: "Données", description: "Importez ou créez vos patients", required: true },
  { id: 4, title: "Premier cas clinique", description: "Créez votre premier acte", required: true },
  { id: 5, title: "Calendrier", description: "Configurez votre agenda", required: false },
  { id: 6, title: "Notifications", description: "Personnalisez vos alertes", required: false },
  { id: 7, title: "Documents", description: "Uploadez un premier document", required: false },
];

export function useOnboarding() {
  const queryClient = useQueryClient();

  const { data: state, isLoading, error, refetch } = useQuery<OnboardingStateResponse>({
    queryKey: ["/api/onboarding"],
  });

  const patchMutation = useMutation({
    mutationFn: async (params: PatchOnboardingParams) => {
      const response = await apiRequest("PATCH", "/api/onboarding", params);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/onboarding/complete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  const goToStep = async (step: number) => {
    await patchMutation.mutateAsync({ currentStep: step });
  };

  const completeStep = async (step: number, dataPatch?: Partial<OnboardingData>) => {
    await patchMutation.mutateAsync({ 
      markCompleteStep: step, 
      currentStep: step + 1,
      dataPatch 
    });
  };

  const skipStep = async (step: number) => {
    await patchMutation.mutateAsync({ 
      markSkipStep: step, 
      currentStep: step + 1 
    });
  };

  const updateData = async (dataPatch: Partial<OnboardingData>) => {
    await patchMutation.mutateAsync({ dataPatch });
  };

  const finishOnboarding = async () => {
    const result = await completeMutation.mutateAsync();
    return result;
  };

  const isStepCompleted = (step: number) => {
    return state?.completedSteps?.[String(step)] === true;
  };

  const isStepSkipped = (step: number) => {
    return state?.skippedSteps?.[String(step)] === true;
  };

  const getProgress = () => {
    if (!state) return 0;
    const completedCount = Object.keys(state.completedSteps || {}).length;
    return Math.round((completedCount / ONBOARDING_STEPS.length) * 100);
  };

  const canComplete = () => {
    if (!state) return false;
    const requiredSteps = ONBOARDING_STEPS.filter(s => s.required).map(s => s.id);
    return requiredSteps.every(step => state.completedSteps?.[String(step)] === true);
  };

  return {
    state,
    isLoading,
    error,
    refetch,
    goToStep,
    completeStep,
    skipStep,
    updateData,
    finishOnboarding,
    isStepCompleted,
    isStepSkipped,
    getProgress,
    canComplete,
    isPending: patchMutation.isPending || completeMutation.isPending,
    isCompleted: state?.status === "COMPLETED",
  };
}

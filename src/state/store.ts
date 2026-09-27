import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { seedAssessments, SITES } from '../core/seed';
import type { Assessment, ReviewStatus, Site } from '../core/types';

interface State {
  userName: string;
  assessments: Assessment[];
  customSites: Site[];
  onboarded: boolean;
  setUserName: (name: string) => void;
  finishOnboarding: () => void;
  addAssessment: (a: Assessment) => void;
  addSite: (s: Site) => void;
  review: (id: string, status: ReviewStatus, reviewer: string, note?: string) => void;
  resetDemo: () => void;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      userName: 'You',
      assessments: seedAssessments(),
      customSites: [],
      onboarded: false,
      setUserName: (userName) => set({ userName: userName.trim() || 'You' }),
      finishOnboarding: () => set({ onboarded: true }),
      addAssessment: (a) => set((s) => ({ assessments: [...s.assessments, a] })),
      addSite: (site) => set((s) => ({ customSites: [...s.customSites, site] })),
      review: (id, status, reviewer, note) =>
        set((s) => ({
          assessments: s.assessments.map((a) => (a.id === id ? { ...a, status, reviewedBy: reviewer, reviewNote: note } : a)),
        })),
      resetDemo: () => set({ assessments: seedAssessments(), customSites: [] }),
    }),
    { name: 'riffle-v2', version: 2 },
  ),
);

export const useSites = (): Site[] => {
  const custom = useStore((s) => s.customSites);
  return useMemo(() => [...SITES, ...custom], [custom]);
};

/** The current citizen's own records (everything not from the demo seed). */
export const useMine = () => {
  const all = useStore((s) => s.assessments);
  return useMemo(() => all.filter((a) => !a.demo), [all]);
};

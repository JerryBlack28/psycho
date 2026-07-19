export type TideKey = 'insight' | 'grounding' | 'connection' | 'vitality';

export type TideLevels = Record<TideKey, number>;

export type QuickNote = {
  id: string;
  text: string;
  mood: string;
  hasImage: boolean;
  imageUri?: string;
  imageRightsConfirmed?: boolean;
  voiceDuration?: number;
  createdAt: number;
};

export type TideCard = {
  id: string;
  tide: TideKey;
  label: string;
  symbol: string;
  quote: string;
  collectedAt: number;
};

export type FutureEcho = {
  id: string;
  text: string;
  createdAt: number;
  revealAt: number;
};

export type ApiSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
  imageDetail: 'high' | 'auto' | 'low';
};

export type AsrSettings = {
  appId: string;
  apiKey: string;
  apiSecret: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type ProfileInsight = {
  title: string;
  description: string;
  confidence: 'low' | 'medium' | 'high';
  uncertainty: string;
  evidence_source_ids: string[];
};

export type ProfileAction = {
  title: string;
  action: string;
  rationale: string;
};

export type ReflectiveProfile = {
  analysis_status: 'limited' | 'sufficient';
  headline: string;
  summary: string;
  current_state: ProfileInsight[];
  recurring_patterns: ProfileInsight[];
  strengths_and_resources: ProfileInsight[];
  needs_and_preferences: ProfileInsight[];
  multimodal_observations: Array<{
    source_ids: string[];
    modality: 'image' | 'cross_modal';
    observation: string;
    contribution_to_profile: string;
    uncertainty: string;
  }>;
  communication_preferences: string[];
  gentle_actions: ProfileAction[];
  reflection_questions: string[];
  uncertainties: string[];
  safety_notice?: {
    level: 'not_indicated' | 'urgent_support_recommended' | 'immediate_danger';
    message: string;
  };
};

export type ProfileEnvelope = {
  local_profile_version: '2.0';
  profile_id: string;
  generated_at: string;
  model: string;
  modalities_used: string[];
  last_evidence_fingerprint: string | null;
  profile: ReflectiveProfile;
};

export type ProfileStatus = {
  state: 'idle' | 'queued' | 'updating' | 'ready' | 'error' | 'safety';
  message: string;
};

export type StoryChoice = {
  label: string;
  result: string;
  tides: Partial<TideLevels>;
};

export type StoryCard = {
  speaker: string;
  role: string;
  portrait: string;
  prompt: string;
  whisper: string;
  left: StoryChoice;
  right: StoryChoice;
};

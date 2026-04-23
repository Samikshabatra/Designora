
export interface User {
  id: string;
  email: string;
  name: string;
  isLoggedIn: boolean;
  credits: number;
  token?: string;  // JWT auth token
}

export interface BudgetBreakdownItem {
  item: string;
  estimatedCost: number;
}

export interface ScannedProduct {
  name: string;
  priceRange: string;
  stores: {
    name: string;
    url: string;
  }[];
}

export interface DesignResult {
  id: string;
  imageUrl: string;
  prompt: string;
  timestamp: number;
  originalImage?: string;
  roomType?: string;
  style?: string;
  budget?: string;
  budgetValue?: number;
  breakdown?: BudgetBreakdownItem[];
  totalEstimatedCost?: number;
  scannedProducts?: ScannedProduct[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export type AppView = 'landing' | 'dashboard' | 'pricing' | 'history';

export enum SubscriptionTier {
  FREE = 'Free',
  PRO = 'Pro',
  ENTERPRISE = 'Enterprise'
}

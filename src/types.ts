export interface Jar {
    id: string;
    name: string;
    allocation_percent: number;
    balance: number;
    color: string;
    icon: string;
}

export interface Transaction {
    id: string;
    amount: number;
    description: string;
    category_id: string;
    date: string;
    jar_id: string;
    type: 'income' | 'expense';
}

export interface ChatMessage {
    text: string;
    isAi: boolean;
    suggestions?: string[];
}

export interface PendingTx {
    extracted_amount: number;
    extracted_name: string;
    predicted_jar_id: string;
    confidence_score: number;
}

export type ActiveTab = 'home' | 'history' | 'ai' | 'profile';
export type AuthMode = 'login' | 'signup';
export type TxType = 'expense' | 'income';

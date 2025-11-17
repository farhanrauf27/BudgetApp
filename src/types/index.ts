export interface Transaction {
  _id?: string;
  name: string; // Added name field
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  monthYear: string;
}

export interface MonthlySummary {
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  transactionCount: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
}
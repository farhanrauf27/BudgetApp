// src/types/lending.ts
export interface Lending {
  _id: string;
  type: 'lend' | 'borrow';
  personName: string;
  amount: number;
  description?: string;
  status: 'pending' | 'paid' | 'received';
  date: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LendingStatistics {
  lend: {
    total: number;
    pending: number;
    paid: number;
    count: number;
    pendingCount: number;
  };
  borrow: {
    total: number;
    pending: number;
    received: number;
    count: number;
    pendingCount: number;
  };
  netBalance: number;
}
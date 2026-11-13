export type TransactionType = "CUENTA POR COBRAR" | "INGRESO" | "EGRESO";
export type TransactionStatus = "PENDIENTE" | "PAGADO" | "CANCELADO";

export interface FinancialAccount { id:string; name:string; account_type:string; opening_balance:number; balance:number; is_active:boolean; }
export interface FinancialTransaction { id:string; account_id:string|null; account_name:string|null; event_id:string|null; event_name:string|null; client_id:string|null; client_name:string|null; musician_id:string|null; musician_name:string|null; transaction_type:TransactionType; concept:string; category:string; amount:number; status:TransactionStatus; transaction_date:string; due_date:string|null; paid_at:string|null; payment_method:string|null; notes:string|null; created_at:string; }
export interface BudgetItem { id:string; item_type:"INGRESO"|"EGRESO"; category:string; description:string; estimated_amount:number; }
export interface FinanceEvent { id:string; name:string; event_date:string; status:string; contracted_value:number; client_name:string; budget_items:BudgetItem[]; actual_income:number; actual_expense:number; }
export interface FinanceOption { id:string; name:string; }
export interface RehearsalReceivable { id:string; amount_due:number; status:"PENDIENTE"|"PAGADO"; paid_at:string|null; notes:string|null; musician_name:string; rehearsal_name:string; rehearsal_date:string; collector_name:string; }
export interface FinanceContext { accounts:FinancialAccount[]; transactions:FinancialTransaction[]; events:FinanceEvent[]; clients:FinanceOption[]; musicians:FinanceOption[]; rehearsal_contributions:{paid:number;pending:number}; }

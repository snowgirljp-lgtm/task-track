export type Role = "reporter" | "resolver" | "admin";
export type Status = "pending" | "in_progress" | "review" | "redo" | "done" | "cancelled";
export type Urgency = "low" | "medium" | "high";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  department_id?: string | null;
  department_ids?: string[];
};

export type Named = { id: string; name: string; is_active: boolean };
export type Project = Named & { company_id: string };

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      company_settings: {
        Row: {
          address: string | null
          bic: string | null
          city: string | null
          company_name: string
          country: string | null
          created_at: string
          default_payment_term_days: number
          default_quote_validity_days: number
          default_vat_rate: number
          email: string | null
          iban: string | null
          id: string
          invoice_footer: string | null
          kvk_number: string | null
          logo_url: string | null
          phone: string | null
          postal_code: string | null
          quote_footer: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          bic?: string | null
          city?: string | null
          company_name?: string
          country?: string | null
          created_at?: string
          default_payment_term_days?: number
          default_quote_validity_days?: number
          default_vat_rate?: number
          email?: string | null
          iban?: string | null
          id?: string
          invoice_footer?: string | null
          kvk_number?: string | null
          logo_url?: string | null
          phone?: string | null
          postal_code?: string | null
          quote_footer?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          bic?: string | null
          city?: string | null
          company_name?: string
          country?: string | null
          created_at?: string
          default_payment_term_days?: number
          default_quote_validity_days?: number
          default_vat_rate?: number
          email?: string | null
          iban?: string | null
          id?: string
          invoice_footer?: string | null
          kvk_number?: string | null
          logo_url?: string | null
          phone?: string | null
          postal_code?: string | null
          quote_footer?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: []
      }
      customer_contacts: {
        Row: {
          created_at: string
          customer_id: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          customer_type: string
          default_vat_rate: number
          default_vat_type: string
          email: string | null
          email_invoice: string | null
          house_number: string | null
          house_number_addition: string | null
          id: string
          kvk_number: string | null
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          street: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          customer_type?: string
          default_vat_rate?: number
          default_vat_type?: string
          email?: string | null
          email_invoice?: string | null
          house_number?: string | null
          house_number_addition?: string | null
          id?: string
          kvk_number?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          customer_type?: string
          default_vat_rate?: number
          default_vat_type?: string
          email?: string | null
          email_invoice?: string | null
          house_number?: string | null
          house_number_addition?: string | null
          id?: string
          kvk_number?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          created_at: string
          document_type: string
          employee_id: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type?: string
          employee_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          employee_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          accident_policy_number: string | null
          arbo_check_date: string | null
          arbo_notes: string | null
          bic: string | null
          bsn: string | null
          city: string | null
          contract_type: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          end_date: string | null
          first_name: string
          hourly_rate: number | null
          hours_per_week: number | null
          house_number: string | null
          house_number_addition: string | null
          iban: string | null
          id: string
          insurance_notes: string | null
          job_title: string | null
          last_name: string
          liability_policy_number: string | null
          medical_exam_date: string | null
          middle_name: string | null
          mobile: string | null
          monthly_salary: number | null
          notes: string | null
          payroll_tax_credit: boolean | null
          phone: string | null
          postal_code: string | null
          probation_end_date: string | null
          safety_instructions_signed: boolean | null
          special_arrangement: string | null
          start_date: string | null
          status: string
          street: string | null
          updated_at: string
          user_id: string
          vacation_days_per_year: number | null
          work_days: string | null
        }
        Insert: {
          accident_policy_number?: string | null
          arbo_check_date?: string | null
          arbo_notes?: string | null
          bic?: string | null
          bsn?: string | null
          city?: string | null
          contract_type?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          end_date?: string | null
          first_name: string
          hourly_rate?: number | null
          hours_per_week?: number | null
          house_number?: string | null
          house_number_addition?: string | null
          iban?: string | null
          id?: string
          insurance_notes?: string | null
          job_title?: string | null
          last_name: string
          liability_policy_number?: string | null
          medical_exam_date?: string | null
          middle_name?: string | null
          mobile?: string | null
          monthly_salary?: number | null
          notes?: string | null
          payroll_tax_credit?: boolean | null
          phone?: string | null
          postal_code?: string | null
          probation_end_date?: string | null
          safety_instructions_signed?: boolean | null
          special_arrangement?: string | null
          start_date?: string | null
          status?: string
          street?: string | null
          updated_at?: string
          user_id: string
          vacation_days_per_year?: number | null
          work_days?: string | null
        }
        Update: {
          accident_policy_number?: string | null
          arbo_check_date?: string | null
          arbo_notes?: string | null
          bic?: string | null
          bsn?: string | null
          city?: string | null
          contract_type?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          end_date?: string | null
          first_name?: string
          hourly_rate?: number | null
          hours_per_week?: number | null
          house_number?: string | null
          house_number_addition?: string | null
          iban?: string | null
          id?: string
          insurance_notes?: string | null
          job_title?: string | null
          last_name?: string
          liability_policy_number?: string | null
          medical_exam_date?: string | null
          middle_name?: string | null
          mobile?: string | null
          monthly_salary?: number | null
          notes?: string | null
          payroll_tax_credit?: boolean | null
          phone?: string | null
          postal_code?: string | null
          probation_end_date?: string | null
          safety_instructions_signed?: boolean | null
          special_arrangement?: string | null
          start_date?: string | null
          status?: string
          street?: string | null
          updated_at?: string
          user_id?: string
          vacation_days_per_year?: number | null
          work_days?: string | null
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          days: number
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          notes: string | null
          reason: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days?: number
          employee_id: string
          end_date: string
          id?: string
          leave_type?: string
          notes?: string | null
          reason?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          notes?: string | null
          reason?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          break_minutes: number
          created_at: string
          customer_id: string | null
          description: string | null
          employee_id: string
          end_time: string | null
          entry_type: string
          hours: number
          id: string
          project: string | null
          start_time: string | null
          status: string
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          break_minutes?: number
          created_at?: string
          customer_id?: string | null
          description?: string | null
          employee_id: string
          end_time?: string | null
          entry_type?: string
          hours?: number
          id?: string
          project?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          break_minutes?: number
          created_at?: string
          customer_id?: string | null
          description?: string | null
          employee_id?: string
          end_time?: string | null
          entry_type?: string
          hours?: number
          id?: string
          project?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bank_balance: {
        Row: {
          balance: number
          balance_as_of: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          balance_as_of?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          balance?: number
          balance_as_of?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_import_batches: {
        Row: {
          created_at: string
          duplicate_count: number
          file_name: string
          id: string
          imported_at: string
          matched_count: number
          partial_match_count: number
          rollback_notes: string | null
          row_count: number
          statement_end_date: string | null
          statement_start_date: string | null
          status: string
          unmatched_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duplicate_count?: number
          file_name: string
          id?: string
          imported_at?: string
          matched_count?: number
          partial_match_count?: number
          rollback_notes?: string | null
          row_count?: number
          statement_end_date?: string | null
          statement_start_date?: string | null
          status?: string
          unmatched_count?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          duplicate_count?: number
          file_name?: string
          id?: string
          imported_at?: string
          matched_count?: number
          partial_match_count?: number
          rollback_notes?: string | null
          row_count?: number
          statement_end_date?: string | null
          statement_start_date?: string | null
          status?: string
          unmatched_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_import_rows: {
        Row: {
          amount: number
          applied_at: string | null
          batch_id: string
          check_number: string | null
          created_at: string
          direction: string
          duplicate_fingerprint: string
          id: string
          is_duplicate: boolean
          normalized_description: string
          posted_date: string
          raw_description: string
          review_status: string
          selected_for_apply: boolean
          suggested_amount_difference: number | null
          suggested_match_confidence: string | null
          suggested_match_id: string | null
          type: string | null
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          amount: number
          applied_at?: string | null
          batch_id: string
          check_number?: string | null
          created_at?: string
          direction: string
          duplicate_fingerprint: string
          id?: string
          is_duplicate?: boolean
          normalized_description: string
          posted_date: string
          raw_description: string
          review_status?: string
          selected_for_apply?: boolean
          suggested_amount_difference?: number | null
          suggested_match_confidence?: string | null
          suggested_match_id?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          applied_at?: string | null
          batch_id?: string
          check_number?: string | null
          created_at?: string
          direction?: string
          duplicate_fingerprint?: string
          id?: string
          is_duplicate?: boolean
          normalized_description?: string
          posted_date?: string
          raw_description?: string
          review_status?: string
          selected_for_apply?: boolean
          suggested_amount_difference?: number | null
          suggested_match_confidence?: string | null
          suggested_match_id?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "bank_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_import_rows_suggested_match_id_fkey"
            columns: ["suggested_match_id"]
            isOneToOne: false
            referencedRelation: "expected_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_import_rows_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_change_log: {
        Row: {
          action_type: string
          after_state: Json | null
          batch_id: string
          before_state: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          rollback_reason: string | null
          rollback_state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          after_state?: Json | null
          batch_id: string
          before_state?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          rollback_reason?: string | null
          rollback_state?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          action_type?: string
          after_state?: Json | null
          batch_id?: string
          before_state?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          rollback_reason?: string | null
          rollback_state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_change_log_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "bank_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      expected_transactions: {
        Row: {
          check_number: string | null
          cleared_at: string | null
          created_at: string
          direction: string
          expected_amount: number
          id: string
          name: string
          notes: string | null
          recurring_template_id: string | null
          scheduled_date: string
          secondary_description: string | null
          source: string
          source_batch_id: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          check_number?: string | null
          cleared_at?: string | null
          created_at?: string
          direction: string
          expected_amount: number
          id?: string
          name: string
          notes?: string | null
          recurring_template_id?: string | null
          scheduled_date: string
          secondary_description?: string | null
          source?: string
          source_batch_id?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Update: {
          check_number?: string | null
          cleared_at?: string | null
          created_at?: string
          direction?: string
          expected_amount?: number
          id?: string
          name?: string
          notes?: string | null
          recurring_template_id?: string | null
          scheduled_date?: string
          secondary_description?: string | null
          source?: string
          source_batch_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expected_transactions_recurring_template_id_fkey"
            columns: ["recurring_template_id"]
            isOneToOne: false
            referencedRelation: "recurring_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expected_transactions_source_batch_id_fkey"
            columns: ["source_batch_id"]
            isOneToOne: false
            referencedRelation: "bank_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expected_transactions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_templates: {
        Row: {
          amount: number
          created_at: string
          direction: string
          frequency: string
          id: string
          is_active: boolean
          last_generated_date: string | null
          name: string
          next_due_date: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          direction: string
          frequency: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          name: string
          next_due_date?: string | null
          type: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          direction?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          name?: string
          next_due_date?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      legacy_transactions: {
        Row: {
          amount: number
          cleared: boolean
          cleared_date: string | null
          created_at: string
          date: string
          direction: string
          id: string
          is_recurring: boolean
          name: string
          source: string
          template_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          cleared?: boolean
          cleared_date?: string | null
          created_at?: string
          date: string
          direction: string
          id?: string
          is_recurring?: boolean
          name: string
          source?: string
          template_id?: string | null
          type: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          cleared?: boolean
          cleared_date?: string | null
          created_at?: string
          date?: string
          direction?: string
          id?: string
          is_recurring?: boolean
          name?: string
          source?: string
          template_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_templates: {
        Row: {
          created_at: string
          day_tolerance: number
          default_amount: number
          direction: string
          frequency: string
          id: string
          is_active: boolean
          last_generated_date: string | null
          name: string
          next_due_date: string | null
          type: string
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          day_tolerance?: number
          default_amount: number
          direction: string
          frequency: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          name: string
          next_due_date?: string | null
          type: string
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          day_tolerance?: number
          default_amount?: number
          direction?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          name?: string
          next_due_date?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_templates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_adjustments: {
        Row: {
          accepted_final_amount: number
          adjustment_amount: number
          apply_to_future_template: boolean
          bank_amount: number
          batch_id: string
          created_at: string
          expected_amount_before: number
          id: string
          notes: string | null
          recurring_template_id: string | null
          transaction_match_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_final_amount: number
          adjustment_amount: number
          apply_to_future_template?: boolean
          bank_amount: number
          batch_id: string
          created_at?: string
          expected_amount_before: number
          id?: string
          notes?: string | null
          recurring_template_id?: string | null
          transaction_match_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          accepted_final_amount?: number
          adjustment_amount?: number
          apply_to_future_template?: boolean
          bank_amount?: number
          batch_id?: string
          created_at?: string
          expected_amount_before?: number
          id?: string
          notes?: string | null
          recurring_template_id?: string | null
          transaction_match_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_adjustments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "bank_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_adjustments_recurring_template_id_fkey"
            columns: ["recurring_template_id"]
            isOneToOne: false
            referencedRelation: "recurring_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_adjustments_transaction_match_id_fkey"
            columns: ["transaction_match_id"]
            isOneToOne: false
            referencedRelation: "transaction_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_matches: {
        Row: {
          amount_difference: number | null
          bank_import_row_id: string
          batch_id: string
          created_at: string
          days_difference: number | null
          expected_transaction_id: string
          id: string
          match_confidence: string
          match_status: string
          matched_by: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_difference?: number | null
          bank_import_row_id: string
          batch_id: string
          created_at?: string
          days_difference?: number | null
          expected_transaction_id: string
          id?: string
          match_confidence: string
          match_status?: string
          matched_by?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount_difference?: number | null
          bank_import_row_id?: string
          batch_id?: string
          created_at?: string
          days_difference?: number | null
          expected_transaction_id?: string
          id?: string
          match_confidence?: string
          match_status?: string
          matched_by?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_matches_bank_import_row_id_fkey"
            columns: ["bank_import_row_id"]
            isOneToOne: false
            referencedRelation: "bank_import_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_matches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "bank_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_matches_expected_transaction_id_fkey"
            columns: ["expected_transaction_id"]
            isOneToOne: false
            referencedRelation: "expected_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_aliases: {
        Row: {
          confidence_source: string
          created_at: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          normalized_alias: string
          raw_alias: string
          times_seen: number
          updated_at: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          confidence_source?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          normalized_alias: string
          raw_alias: string
          times_seen?: number
          updated_at?: string
          user_id?: string
          vendor_id: string
        }
        Update: {
          confidence_source?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          normalized_alias?: string
          raw_alias?: string
          times_seen?: number
          updated_at?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_aliases_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          canonical_name: string
          created_at: string
          default_direction: string | null
          default_type: string | null
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          canonical_name: string
          created_at?: string
          default_direction?: string | null
          default_type?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          canonical_name?: string
          created_at?: string
          default_direction?: string | null
          default_type?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
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

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          name: string
          picture_url: string | null
          public_data: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          picture_url?: string | null
          public_data?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          picture_url?: string | null
          public_data?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      coverages: {
        Row: {
          coverage_type: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          effective_date: string | null
          group_number: string | null
          id: string
          is_active: boolean
          member_id: string
          organization_id: string
          patient_id: string
          payer_id: string | null
          payer_label: string
          subscriber_id: string
          termination_date: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          coverage_type?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          effective_date?: string | null
          group_number?: string | null
          id?: string
          is_active?: boolean
          member_id?: string
          organization_id: string
          patient_id: string
          payer_id?: string | null
          payer_label: string
          subscriber_id: string
          termination_date?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          coverage_type?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          effective_date?: string | null
          group_number?: string | null
          id?: string
          is_active?: boolean
          member_id?: string
          organization_id?: string
          patient_id?: string
          payer_id?: string | null
          payer_label?: string
          subscriber_id?: string
          termination_date?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coverages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverages_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverages_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          facility_type: string
          id: string
          is_active: boolean
          name: string
          npi: string | null
          organization_id: string
          postal_code: string | null
          sim_facility_id: string
          state: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          facility_type?: string
          id?: string
          is_active?: boolean
          name: string
          npi?: string | null
          organization_id: string
          postal_code?: string | null
          sim_facility_id?: string
          state?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          facility_type?: string
          id?: string
          is_active?: boolean
          name?: string
          npi?: string | null
          organization_id?: string
          postal_code?: string | null
          sim_facility_id?: string
          state?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facilities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role_id: string
          status: string
          token: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role_id: string
          status?: string
          token?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role_id?: string
          status?: string
          token?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          invited_by: string | null
          organization_id: string
          role_id: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id: string
          role_id: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id?: string
          role_id?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_payer_enrollments: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          effective_date: string | null
          id: string
          notes: string | null
          organization_id: string
          payer_id: string | null
          payer_label: string
          status: string
          termination_date: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          effective_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payer_id?: string | null
          payer_label: string
          status?: string
          termination_date?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          effective_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payer_id?: string | null
          payer_label?: string
          status?: string
          termination_date?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_payer_enrollments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_payer_enrollments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          slug: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      patients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          created_at: string | null
          created_by: string | null
          date_of_birth: string
          deleted_at: string | null
          first_name: string
          gender: string
          id: string
          is_active: boolean
          last_name: string
          organization_id: string
          postal_code: string | null
          sim_patient_id: string
          state: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth: string
          deleted_at?: string | null
          first_name: string
          gender?: string
          id?: string
          is_active?: boolean
          last_name: string
          organization_id: string
          postal_code?: string | null
          sim_patient_id?: string
          state?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string
          deleted_at?: string | null
          first_name?: string
          gender?: string
          id?: string
          is_active?: boolean
          last_name?: string
          organization_id?: string
          postal_code?: string | null
          sim_patient_id?: string
          state?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payer_aliases: {
        Row: {
          alias: string
          created_at: string | null
          created_by: string | null
          id: string
          payer_id: string
        }
        Insert: {
          alias: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          payer_id: string
        }
        Update: {
          alias?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          payer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payer_aliases_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      payer_routes: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          payer_id: string
          route_name: string
          route_type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          payer_id: string
          route_name: string
          route_type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          payer_id?: string
          route_name?: string
          route_type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payer_routes_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      payer_rule_versions: {
        Row: {
          condition: string
          created_at: string | null
          created_by: string | null
          effective_date: string | null
          expiration_date: string | null
          explanation: string
          field_path: string | null
          id: string
          is_active: boolean
          outcome: string
          payer_rule_id: string
          rejection_or_denial: string
          severity: string
          source: string | null
          suggested_correction: string | null
          version_number: number
        }
        Insert: {
          condition: string
          created_at?: string | null
          created_by?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          explanation: string
          field_path?: string | null
          id?: string
          is_active?: boolean
          outcome: string
          payer_rule_id: string
          rejection_or_denial: string
          severity: string
          source?: string | null
          suggested_correction?: string | null
          version_number: number
        }
        Update: {
          condition?: string
          created_at?: string | null
          created_by?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          explanation?: string
          field_path?: string | null
          id?: string
          is_active?: boolean
          outcome?: string
          payer_rule_id?: string
          rejection_or_denial?: string
          severity?: string
          source?: string | null
          suggested_correction?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "payer_rule_versions_payer_rule_id_fkey"
            columns: ["payer_rule_id"]
            isOneToOne: false
            referencedRelation: "payer_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      payer_rules: {
        Row: {
          category: string
          claim_type: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          payer_id: string | null
          rule_code: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          category: string
          claim_type?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          payer_id?: string | null
          rule_code: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          category?: string
          claim_type?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          payer_id?: string | null
          rule_code?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payer_rules_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      payer_supported_transactions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          payer_id: string
          transaction_type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          payer_id: string
          transaction_type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          payer_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payer_supported_transactions_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      payer_test_profiles: {
        Row: {
          created_at: string | null
          created_by: string | null
          default_outcome: string
          denial_rule_code: string | null
          id: string
          notes: string | null
          payer_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          default_outcome?: string
          denial_rule_code?: string | null
          id?: string
          notes?: string | null
          payer_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          default_outcome?: string
          denial_rule_code?: string | null
          id?: string
          notes?: string | null
          payer_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payer_test_profiles_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: true
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      payers: {
        Row: {
          category: string
          clearinghouse_payer_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          display_name: string
          effective_date: string | null
          enrollment_required: boolean
          id: string
          is_active: boolean
          last_verified_date: string | null
          legal_name: string | null
          line_of_business: string | null
          network_name: string | null
          notes: string | null
          public_program_id: string | null
          scope: string
          sim_payer_id: string
          source: string | null
          state: string | null
          termination_date: string | null
          test_production: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          category: string
          clearinghouse_payer_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          display_name: string
          effective_date?: string | null
          enrollment_required?: boolean
          id?: string
          is_active?: boolean
          last_verified_date?: string | null
          legal_name?: string | null
          line_of_business?: string | null
          network_name?: string | null
          notes?: string | null
          public_program_id?: string | null
          scope?: string
          sim_payer_id: string
          source?: string | null
          state?: string | null
          termination_date?: string | null
          test_production?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          category?: string
          clearinghouse_payer_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          display_name?: string
          effective_date?: string | null
          enrollment_required?: boolean
          id?: string
          is_active?: boolean
          last_verified_date?: string | null
          legal_name?: string | null
          line_of_business?: string | null
          network_name?: string | null
          notes?: string | null
          public_program_id?: string | null
          scope?: string
          sim_payer_id?: string
          source?: string | null
          state?: string | null
          termination_date?: string | null
          test_production?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          npi: string
          organization_id: string
          organization_name: string | null
          provider_type: string
          sim_provider_id: string
          taxonomy_code: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          npi: string
          organization_id: string
          organization_name?: string | null
          provider_type: string
          sim_provider_id?: string
          taxonomy_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          npi?: string
          organization_id?: string
          organization_name?: string | null
          provider_type?: string
          sim_provider_id?: string
          taxonomy_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_platform_role: boolean
          key: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_platform_role?: boolean
          key: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_platform_role?: boolean
          key?: string
          name?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          organization_id: string
          patient_id: string
          relationship_to_patient: string
          sim_subscriber_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          organization_id: string
          patient_id: string
          relationship_to_patient?: string
          sim_subscriber_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          organization_id?: string
          patient_id?: string
          relationship_to_patient?: string
          sim_subscriber_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscribers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscribers_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          name: string | null
          picture_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          picture_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          picture_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: {
        Args: { invitation_token: string }
        Returns: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          invited_by: string | null
          organization_id: string
          role_id: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
      }
      create_organization: {
        Args: { org_name: string; org_slug: string }
        Returns: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          slug: string
          updated_at: string | null
          updated_by: string | null
        }
      }
      get_organization_members: {
        Args: { target_org_id: string }
        Returns: {
          created_at: string
          email: string
          membership_id: string
          name: string
          picture_url: string
          role_key: string
          role_name: string
          user_id: string
        }[]
      }
      has_org_access: {
        Args: { target_org_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { permission_key: string; target_org_id: string }
        Returns: boolean
      }
      is_platform_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          format: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          format?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          level: number | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      prefixes: {
        Row: {
          bucket_id: string
          created_at: string | null
          level: number
          name: string
          updated_at: string | null
        }
        Insert: {
          bucket_id: string
          created_at?: string | null
          level?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          bucket_id?: string
          created_at?: string | null
          level?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prefixes_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_prefixes: {
        Args: { _bucket_id: string; _name: string }
        Returns: undefined
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      delete_leaf_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      delete_prefix: {
        Args: { _bucket_id: string; _name: string }
        Returns: boolean
      }
      extension: {
        Args: { name: string }
        Returns: string
      }
      filename: {
        Args: { name: string }
        Returns: string
      }
      foldername: {
        Args: { name: string }
        Returns: string[]
      }
      get_level: {
        Args: { name: string }
        Returns: number
      }
      get_prefix: {
        Args: { name: string }
        Returns: string
      }
      get_prefixes: {
        Args: { name: string }
        Returns: string[]
      }
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          start_after?: string
        }
        Returns: {
          id: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      lock_top_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      operation: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_legacy_v1: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v1_optimised: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS"],
    },
  },
} as const


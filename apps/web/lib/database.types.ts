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
      acknowledgments: {
        Row: {
          ack_type: string
          code: string
          created_at: string | null
          created_by: string | null
          edi_transaction_id: string
          explanation: string
          gs06: string | null
          id: string
          isa13: string | null
          organization_id: string
          st02: string | null
          status: string
        }
        Insert: {
          ack_type: string
          code: string
          created_at?: string | null
          created_by?: string | null
          edi_transaction_id: string
          explanation: string
          gs06?: string | null
          id?: string
          isa13?: string | null
          organization_id: string
          st02?: string | null
          status: string
        }
        Update: {
          ack_type?: string
          code?: string
          created_at?: string | null
          created_by?: string | null
          edi_transaction_id?: string
          explanation?: string
          gs06?: string | null
          id?: string
          isa13?: string | null
          organization_id?: string
          st02?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "acknowledgments_edi_transaction_id_fkey"
            columns: ["edi_transaction_id"]
            isOneToOne: false
            referencedRelation: "edi_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_adjustments: {
        Row: {
          adjustment_group: string
          amount: number
          carc_code: string
          created_at: string | null
          created_by: string | null
          explanation: string
          id: string
          organization_id: string
          rarc_code: string | null
          remit_claim_id: string
          rule_id: string | null
        }
        Insert: {
          adjustment_group: string
          amount: number
          carc_code: string
          created_at?: string | null
          created_by?: string | null
          explanation: string
          id?: string
          organization_id: string
          rarc_code?: string | null
          remit_claim_id: string
          rule_id?: string | null
        }
        Update: {
          adjustment_group?: string
          amount?: number
          carc_code?: string
          created_at?: string | null
          created_by?: string | null
          explanation?: string
          id?: string
          organization_id?: string
          rarc_code?: string | null
          remit_claim_id?: string
          rule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_adjustments_remit_claim_id_fkey"
            columns: ["remit_claim_id"]
            isOneToOne: false
            referencedRelation: "remit_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_adjustments_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "payer_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_batches: {
        Row: {
          batch_name: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          organization_id: string
          sim_batch_id: string
          status: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          batch_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id: string
          sim_batch_id?: string
          status?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          batch_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id?: string
          sim_batch_id?: string
          status?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_diagnoses: {
        Row: {
          claim_id: string
          created_at: string | null
          created_by: string | null
          diagnosis_code: string
          diagnosis_pointer: number
          id: string
          is_primary: boolean
          organization_id: string
        }
        Insert: {
          claim_id: string
          created_at?: string | null
          created_by?: string | null
          diagnosis_code: string
          diagnosis_pointer: number
          id?: string
          is_primary?: boolean
          organization_id: string
        }
        Update: {
          claim_id?: string
          created_at?: string | null
          created_by?: string | null
          diagnosis_code?: string
          diagnosis_pointer?: number
          id?: string
          is_primary?: boolean
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_diagnoses_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_diagnoses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_documents: {
        Row: {
          claim_id: string
          created_at: string | null
          created_by: string | null
          document_name: string
          document_type: string | null
          id: string
          notes: string | null
          organization_id: string
        }
        Insert: {
          claim_id: string
          created_at?: string | null
          created_by?: string | null
          document_name: string
          document_type?: string | null
          id?: string
          notes?: string | null
          organization_id: string
        }
        Update: {
          claim_id?: string
          created_at?: string | null
          created_by?: string | null
          document_name?: string
          document_type?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_documents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_lines: {
        Row: {
          charge_amount: number
          claim_id: string
          created_at: string | null
          created_by: string | null
          diagnosis_pointers: number[]
          id: string
          line_number: number
          modifiers: string[] | null
          organization_id: string
          place_of_service: string | null
          procedure_code: string | null
          revenue_code: string | null
          service_date: string
          units: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          charge_amount: number
          claim_id: string
          created_at?: string | null
          created_by?: string | null
          diagnosis_pointers?: number[]
          id?: string
          line_number: number
          modifiers?: string[] | null
          organization_id: string
          place_of_service?: string | null
          procedure_code?: string | null
          revenue_code?: string | null
          service_date: string
          units?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          charge_amount?: number
          claim_id?: string
          created_at?: string | null
          created_by?: string | null
          diagnosis_pointers?: number[]
          id?: string
          line_number?: number
          modifiers?: string[] | null
          organization_id?: string
          place_of_service?: string | null
          procedure_code?: string | null
          revenue_code?: string | null
          service_date?: string
          units?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_lines_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_relationships: {
        Row: {
          claim_id: string
          created_at: string | null
          created_by: string | null
          id: string
          organization_id: string
          related_claim_id: string
          relationship_type: string
        }
        Insert: {
          claim_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id: string
          related_claim_id: string
          relationship_type: string
        }
        Update: {
          claim_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id?: string
          related_claim_id?: string
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_relationships_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_relationships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_relationships_related_claim_id_fkey"
            columns: ["related_claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          batch_id: string | null
          billing_provider_id: string
          claim_type: string
          coverage_id: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          last_validation_result: Json | null
          notes: string | null
          organization_id: string
          patient_id: string
          sim_claim_id: string
          status: string
          subscriber_id: string
          updated_at: string | null
          updated_by: string | null
          validated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          billing_provider_id: string
          claim_type: string
          coverage_id: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          last_validation_result?: Json | null
          notes?: string | null
          organization_id: string
          patient_id: string
          sim_claim_id?: string
          status?: string
          subscriber_id: string
          updated_at?: string | null
          updated_by?: string | null
          validated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          billing_provider_id?: string
          claim_type?: string
          coverage_id?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          last_validation_result?: Json | null
          notes?: string | null
          organization_id?: string
          patient_id?: string
          sim_claim_id?: string
          status?: string
          subscriber_id?: string
          updated_at?: string | null
          updated_by?: string | null
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "claim_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_billing_provider_id_fkey"
            columns: ["billing_provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_coverage_id_fkey"
            columns: ["coverage_id"]
            isOneToOne: false
            referencedRelation: "coverages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
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
      edi_payloads: {
        Row: {
          created_at: string | null
          created_by: string | null
          direction: string
          edi_transaction_id: string
          id: string
          organization_id: string
          payload_hash: string
          raw_payload: string
          transaction_type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          direction: string
          edi_transaction_id: string
          id?: string
          organization_id: string
          payload_hash: string
          raw_payload: string
          transaction_type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          direction?: string
          edi_transaction_id?: string
          id?: string
          organization_id?: string
          payload_hash?: string
          raw_payload?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "edi_payloads_edi_transaction_id_fkey"
            columns: ["edi_transaction_id"]
            isOneToOne: false
            referencedRelation: "edi_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edi_payloads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      edi_transactions: {
        Row: {
          batch_id: string | null
          claim_id: string
          created_at: string | null
          created_by: string | null
          gs06: string
          id: string
          isa13: string
          organization_id: string
          st02: string
          transaction_type: string
        }
        Insert: {
          batch_id?: string | null
          claim_id: string
          created_at?: string | null
          created_by?: string | null
          gs06: string
          id?: string
          isa13: string
          organization_id: string
          st02: string
          transaction_type: string
        }
        Update: {
          batch_id?: string | null
          claim_id?: string
          created_at?: string | null
          created_by?: string | null
          gs06?: string
          id?: string
          isa13?: string
          organization_id?: string
          st02?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "edi_transactions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "claim_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edi_transactions_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edi_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      eft_traces: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          effective_date: string
          eft_trace_number: string
          id: string
          organization_id: string
          remittance_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          effective_date?: string
          eft_trace_number?: string
          id?: string
          organization_id: string
          remittance_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          effective_date?: string
          eft_trace_number?: string
          id?: string
          organization_id?: string
          remittance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eft_traces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eft_traces_remittance_id_fkey"
            columns: ["remittance_id"]
            isOneToOne: true
            referencedRelation: "remittances"
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
      institutional_claim_details: {
        Row: {
          admission_date: string | null
          claim_id: string
          created_at: string | null
          created_by: string | null
          discharge_date: string | null
          facility_id: string
          organization_id: string
          type_of_bill: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          admission_date?: string | null
          claim_id: string
          created_at?: string | null
          created_by?: string | null
          discharge_date?: string | null
          facility_id: string
          organization_id: string
          type_of_bill: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          admission_date?: string | null
          claim_id?: string
          created_at?: string | null
          created_by?: string | null
          discharge_date?: string | null
          facility_id?: string
          organization_id?: string
          type_of_bill?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institutional_claim_details_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_claim_details_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_claim_details_organization_id_fkey"
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
      payment_matches: {
        Row: {
          created_by: string | null
          eft_trace_id: string
          id: string
          matched_amount: number
          matched_at: string | null
          organization_id: string
          remittance_id: string
        }
        Insert: {
          created_by?: string | null
          eft_trace_id: string
          id?: string
          matched_amount: number
          matched_at?: string | null
          organization_id: string
          remittance_id: string
        }
        Update: {
          created_by?: string | null
          eft_trace_id?: string
          id?: string
          matched_amount?: number
          matched_at?: string | null
          organization_id?: string
          remittance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_matches_eft_trace_id_fkey"
            columns: ["eft_trace_id"]
            isOneToOne: true
            referencedRelation: "eft_traces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_matches_remittance_id_fkey"
            columns: ["remittance_id"]
            isOneToOne: false
            referencedRelation: "remittances"
            referencedColumns: ["id"]
          },
        ]
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
      processing_jobs: {
        Row: {
          claim_id: string
          completed_at: string | null
          correlation_id: string
          created_at: string | null
          created_by: string | null
          id: string
          idempotency_key: string
          organization_id: string
          result: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          claim_id: string
          completed_at?: string | null
          correlation_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          idempotency_key: string
          organization_id: string
          result?: Json | null
          started_at?: string | null
          status?: string
        }
        Update: {
          claim_id?: string
          completed_at?: string | null
          correlation_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          idempotency_key?: string
          organization_id?: string
          result?: Json | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_claim_details: {
        Row: {
          claim_id: string
          created_at: string | null
          created_by: string | null
          organization_id: string
          rendering_provider_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string | null
          created_by?: string | null
          organization_id: string
          rendering_provider_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string | null
          created_by?: string | null
          organization_id?: string
          rendering_provider_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_claim_details_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_claim_details_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_claim_details_rendering_provider_id_fkey"
            columns: ["rendering_provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
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
      remit_claims: {
        Row: {
          charge_amount: number
          claim_id: string
          created_at: string | null
          created_by: string | null
          id: string
          organization_id: string
          paid_amount: number
          patient_responsibility: number
          remittance_id: string
        }
        Insert: {
          charge_amount: number
          claim_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id: string
          paid_amount?: number
          patient_responsibility?: number
          remittance_id: string
        }
        Update: {
          charge_amount?: number
          claim_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id?: string
          paid_amount?: number
          patient_responsibility?: number
          remittance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remit_claims_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remit_claims_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remit_claims_remittance_id_fkey"
            columns: ["remittance_id"]
            isOneToOne: true
            referencedRelation: "remittances"
            referencedColumns: ["id"]
          },
        ]
      }
      remit_service_lines: {
        Row: {
          charge_amount: number
          claim_line_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          organization_id: string
          paid_amount: number
          remit_claim_id: string
        }
        Insert: {
          charge_amount: number
          claim_line_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id: string
          paid_amount?: number
          remit_claim_id: string
        }
        Update: {
          charge_amount?: number
          claim_line_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id?: string
          paid_amount?: number
          remit_claim_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remit_service_lines_claim_line_id_fkey"
            columns: ["claim_line_id"]
            isOneToOne: false
            referencedRelation: "claim_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remit_service_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remit_service_lines_remit_claim_id_fkey"
            columns: ["remit_claim_id"]
            isOneToOne: false
            referencedRelation: "remit_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      remittances: {
        Row: {
          claim_id: string
          created_at: string | null
          created_by: string | null
          gs06: string
          id: string
          isa13: string
          organization_id: string
          outcome: string
          payer_id: string | null
          payload_hash: string
          raw_835_payload: string
          sim_remittance_id: string
          st02: string
          status: string
          total_paid_amount: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string | null
          created_by?: string | null
          gs06: string
          id?: string
          isa13: string
          organization_id: string
          outcome: string
          payer_id?: string | null
          payload_hash: string
          raw_835_payload: string
          sim_remittance_id?: string
          st02: string
          status: string
          total_paid_amount?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string | null
          created_by?: string | null
          gs06?: string
          id?: string
          isa13?: string
          organization_id?: string
          outcome?: string
          payer_id?: string | null
          payload_hash?: string
          raw_835_payload?: string
          sim_remittance_id?: string
          st02?: string
          status?: string
          total_paid_amount?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remittances_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remittances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remittances_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      replay_attempts: {
        Row: {
          attempted_at: string | null
          attempted_by: string | null
          claim_id: string
          id: string
          idempotency_key: string
          organization_id: string
          outcome: string
          processing_job_id: string | null
        }
        Insert: {
          attempted_at?: string | null
          attempted_by?: string | null
          claim_id: string
          id?: string
          idempotency_key: string
          organization_id: string
          outcome: string
          processing_job_id?: string | null
        }
        Update: {
          attempted_at?: string | null
          attempted_by?: string | null
          claim_id?: string
          id?: string
          idempotency_key?: string
          organization_id?: string
          outcome?: string
          processing_job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "replay_attempts_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replay_attempts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replay_attempts_processing_job_id_fkey"
            columns: ["processing_job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
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
      rule_evaluations: {
        Row: {
          category: string | null
          claim_id: string
          created_at: string | null
          created_by: string | null
          explanation: string | null
          id: string
          organization_id: string
          passed: boolean
          processing_job_id: string | null
          rejection_or_denial: string | null
          rule_code: string
          severity: string | null
        }
        Insert: {
          category?: string | null
          claim_id: string
          created_at?: string | null
          created_by?: string | null
          explanation?: string | null
          id?: string
          organization_id: string
          passed: boolean
          processing_job_id?: string | null
          rejection_or_denial?: string | null
          rule_code: string
          severity?: string | null
        }
        Update: {
          category?: string | null
          claim_id?: string
          created_at?: string | null
          created_by?: string | null
          explanation?: string | null
          id?: string
          organization_id?: string
          passed?: boolean
          processing_job_id?: string | null
          rejection_or_denial?: string | null
          rule_code?: string
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_evaluations_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_evaluations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_evaluations_processing_job_id_fkey"
            columns: ["processing_job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
        ]
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
      transaction_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          batch_id: string | null
          claim_id: string
          code: string | null
          correlation_id: string
          created_at: string | null
          created_by: string | null
          edi_transaction_id: string | null
          event_category: string
          event_name: string
          explanation: string
          gs06: string | null
          id: string
          isa13: string | null
          next_recommended_action: string | null
          occurred_at: string
          organization_id: string
          payer_id: string | null
          previous_event_id: string | null
          request_payload_hash: string | null
          response_payload_hash: string | null
          route: string | null
          rule_id: string | null
          st02: string | null
          status: string
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          batch_id?: string | null
          claim_id: string
          code?: string | null
          correlation_id: string
          created_at?: string | null
          created_by?: string | null
          edi_transaction_id?: string | null
          event_category: string
          event_name: string
          explanation: string
          gs06?: string | null
          id?: string
          isa13?: string | null
          next_recommended_action?: string | null
          occurred_at?: string
          organization_id: string
          payer_id?: string | null
          previous_event_id?: string | null
          request_payload_hash?: string | null
          response_payload_hash?: string | null
          route?: string | null
          rule_id?: string | null
          st02?: string | null
          status: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          batch_id?: string | null
          claim_id?: string
          code?: string | null
          correlation_id?: string
          created_at?: string | null
          created_by?: string | null
          edi_transaction_id?: string | null
          event_category?: string
          event_name?: string
          explanation?: string
          gs06?: string | null
          id?: string
          isa13?: string | null
          next_recommended_action?: string | null
          occurred_at?: string
          organization_id?: string
          payer_id?: string | null
          previous_event_id?: string | null
          request_payload_hash?: string | null
          response_payload_hash?: string | null
          route?: string | null
          rule_id?: string | null
          st02?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "claim_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_events_edi_transaction_id_fkey"
            columns: ["edi_transaction_id"]
            isOneToOne: false
            referencedRelation: "edi_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_events_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_events_previous_event_id_fkey"
            columns: ["previous_event_id"]
            isOneToOne: false
            referencedRelation: "transaction_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "payer_rules"
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
      create_institutional_claim: {
        Args: {
          p_admission_date?: string
          p_billing_provider_id: string
          p_coverage_id: string
          p_discharge_date?: string
          p_facility_id: string
          p_notes?: string
          p_organization_id: string
          p_patient_id: string
          p_subscriber_id: string
          p_type_of_bill: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          batch_id: string | null
          billing_provider_id: string
          claim_type: string
          coverage_id: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          last_validation_result: Json | null
          notes: string | null
          organization_id: string
          patient_id: string
          sim_claim_id: string
          status: string
          subscriber_id: string
          updated_at: string | null
          updated_by: string | null
          validated_at: string | null
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
      create_professional_claim: {
        Args: {
          p_billing_provider_id: string
          p_coverage_id: string
          p_notes?: string
          p_organization_id: string
          p_patient_id: string
          p_rendering_provider_id: string
          p_subscriber_id: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          batch_id: string | null
          billing_provider_id: string
          claim_type: string
          coverage_id: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          last_validation_result: Json | null
          notes: string | null
          organization_id: string
          patient_id: string
          sim_claim_id: string
          status: string
          subscriber_id: string
          updated_at: string | null
          updated_by: string | null
          validated_at: string | null
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


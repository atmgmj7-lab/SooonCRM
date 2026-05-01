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
      ad_sets: {
        Row: {
          id: string
          tenant_id: string
          campaign_id: string
          external_id: string
          name: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          campaign_id: string
          external_id: string
          name: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          campaign_id?: string
          external_id?: string
          name?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_sets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_sets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          created_at: string
          ended_at: string | null
          external_id: string | null
          id: string
          metadata: Json
          name: string
          objective: string | null
          platform: string
          started_at: string | null
          status: string
          tenant_id: string
          total_clicks: number
          total_impressions: number
          total_leads: number
          total_spend: number
          updated_at: string
          visible?: boolean | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json
          name: string
          objective?: string | null
          platform: string
          started_at?: string | null
          status?: string
          tenant_id: string
          total_clicks?: number
          total_impressions?: number
          total_leads?: number
          total_spend?: number
          updated_at?: string
          visible?: boolean | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json
          name?: string
          objective?: string | null
          platform?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
          total_clicks?: number
          total_impressions?: number
          total_leads?: number
          total_spend?: number
          updated_at?: string
          visible?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_creatives: {
        Row: {
          ad_format: string | null
          campaign_id: string
          created_at: string
          external_id: string | null
          id: string
          metadata: Json
          name: string
          tenant_id: string
          thumbnail_url: string | null
          total_clicks: number
          total_impressions: number
          total_leads: number
          total_spend: number
          updated_at: string
        }
        Insert: {
          ad_format?: string | null
          campaign_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          metadata?: Json
          name: string
          tenant_id: string
          thumbnail_url?: string | null
          total_clicks?: number
          total_impressions?: number
          total_leads?: number
          total_spend?: number
          updated_at?: string
        }
        Update: {
          ad_format?: string | null
          campaign_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          metadata?: Json
          name?: string
          tenant_id?: string
          thumbnail_url?: string | null
          total_clicks?: number
          total_impressions?: number
          total_leads?: number
          total_spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_creatives_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_creatives_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_spend_daily: {
        Row: {
          ad_set_id: string | null
          campaign_id: string
          clicks: number
          cpc: number | null
          cpm: number | null
          created_at: string
          creative_id: string | null
          ctr: number | null
          engagements: number | null
          frequency: number | null
          id: string
          impressions: number
          installs: number | null
          leads_count: number
          metadata: Json
          reach: number
          spend_amount: number
          spend_date: string
          tenant_id: string
          video_views: number | null
        }
        Insert: {
          ad_set_id?: string | null
          campaign_id: string
          clicks?: number
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          creative_id?: string | null
          ctr?: number | null
          engagements?: number | null
          frequency?: number | null
          id?: string
          impressions?: number
          installs?: number | null
          leads_count?: number
          metadata?: Json
          reach?: number
          spend_amount?: number
          spend_date: string
          tenant_id: string
          video_views?: number | null
        }
        Update: {
          ad_set_id?: string | null
          campaign_id?: string
          clicks?: number
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          creative_id?: string | null
          ctr?: number | null
          engagements?: number | null
          frequency?: number | null
          id?: string
          impressions?: number
          installs?: number | null
          leads_count?: number
          metadata?: Json
          reach?: number
          spend_amount?: number
          spend_date?: string
          tenant_id?: string
          video_views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_spend_daily_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_spend_daily_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_spend_daily_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "ad_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_spend_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_sync_state: {
        Row: {
          last_synced_date: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          last_synced_date: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          last_synced_date?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_sync_state_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_instructions: {
        Row: {
          agent_type: string
          confidence_score: number | null
          created_at: string
          id: string
          instruction: string
          instruction_data: Json | null
          reasoning: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_call_ids: string[] | null
          status: string
          target_id: string | null
          target_type: string
          tenant_id: string
        }
        Insert: {
          agent_type: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          instruction: string
          instruction_data?: Json | null
          reasoning?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_call_ids?: string[] | null
          status?: string
          target_id?: string | null
          target_type: string
          tenant_id: string
        }
        Update: {
          agent_type?: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          instruction?: string
          instruction_data?: Json | null
          reasoning?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_call_ids?: string[] | null
          status?: string
          target_id?: string | null
          target_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_instructions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instructions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_metrics: {
        Row: {
          accuracy_rate: number | null
          agent_type: string
          approved_count: number
          auto_executed_count: number
          created_at: string
          custom_metrics: Json
          data_points_used: number
          id: string
          metric_date: string
          model_version: string | null
          rejected_count: number
          tenant_id: string
          total_instructions: number
        }
        Insert: {
          accuracy_rate?: number | null
          agent_type: string
          approved_count?: number
          auto_executed_count?: number
          created_at?: string
          custom_metrics?: Json
          data_points_used?: number
          id?: string
          metric_date?: string
          model_version?: string | null
          rejected_count?: number
          tenant_id: string
          total_instructions?: number
        }
        Update: {
          accuracy_rate?: number | null
          agent_type?: string
          approved_count?: number
          auto_executed_count?: number
          created_at?: string
          custom_metrics?: Json
          data_points_used?: number
          id?: string
          metric_date?: string
          model_version?: string | null
          rejected_count?: number
          tenant_id?: string
          total_instructions?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_patterns: {
        Row: {
          applied_to_agent: string | null
          approved_at: string | null
          approved_by: string | null
          baseline_rate: number | null
          created_at: string
          discovered_by_agent: string
          id: string
          improved_rate: number | null
          pattern_data: Json
          pattern_summary: string
          pattern_type: string
          sample_size: number
          status: string
          tenant_id: string
        }
        Insert: {
          applied_to_agent?: string | null
          approved_at?: string | null
          approved_by?: string | null
          baseline_rate?: number | null
          created_at?: string
          discovered_by_agent: string
          id?: string
          improved_rate?: number | null
          pattern_data: Json
          pattern_summary: string
          pattern_type: string
          sample_size: number
          status?: string
          tenant_id: string
        }
        Update: {
          applied_to_agent?: string | null
          approved_at?: string | null
          approved_by?: string | null
          baseline_rate?: number | null
          created_at?: string
          discovered_by_agent?: string
          id?: string
          improved_rate?: number | null
          pattern_data?: Json
          pattern_summary?: string
          pattern_type?: string
          sample_size?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_patterns_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_patterns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      call_embeddings: {
        Row: {
          call_id: string
          chunk_index: number
          chunk_text: string
          created_at: string
          embedding: string
          id: string
          metadata: Json
          tenant_id: string
        }
        Insert: {
          call_id: string
          chunk_index?: number
          chunk_text: string
          created_at?: string
          embedding: string
          id?: string
          metadata?: Json
          tenant_id: string
        }
        Update: {
          call_id?: string
          chunk_index?: number
          chunk_text?: string
          created_at?: string
          embedding?: string
          id?: string
          metadata?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_embeddings_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_embeddings_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "v_call_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_embeddings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          ai_analysis_status: string
          call_id: string
          created_at: string
          full_text: string | null
          id: string
          key_points: Json | null
          processed_at: string | null
          sentiment: string | null
          speaker_segments: Json | null
          summary: string | null
          tenant_id: string
          whisper_status: string
        }
        Insert: {
          ai_analysis_status?: string
          call_id: string
          created_at?: string
          full_text?: string | null
          id?: string
          key_points?: Json | null
          processed_at?: string | null
          sentiment?: string | null
          speaker_segments?: Json | null
          summary?: string | null
          tenant_id: string
          whisper_status?: string
        }
        Update: {
          ai_analysis_status?: string
          call_id?: string
          created_at?: string
          full_text?: string | null
          id?: string
          key_points?: Json | null
          processed_at?: string | null
          sentiment?: string | null
          speaker_segments?: Json | null
          summary?: string | null
          tenant_id?: string
          whisper_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "v_call_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transcripts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          agent_display_name: string | null
          agent_id: string | null
          appo_detail: string | null
          audio_r2_key: string | null
          audio_url: string | null
          category: string | null
          cl: string | null
          created_at: string
          custom_data: Json
          customer_id: string
          day_of_week: string | null
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          fm_record_id: string | null
          fm_synced_at: string | null
          id: string
          lead_id: string
          rep_hit: string | null
          rep_level: string | null
          rep_level2: string | null
          result: string | null
          result_note: string | null
          started_at: string
          tenant_id: string
        }
        Insert: {
          agent_display_name?: string | null
          agent_id?: string | null
          appo_detail?: string | null
          audio_r2_key?: string | null
          audio_url?: string | null
          category?: string | null
          cl?: string | null
          created_at?: string
          custom_data?: Json
          customer_id: string
          day_of_week?: string | null
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          fm_record_id?: string | null
          fm_synced_at?: string | null
          id?: string
          lead_id: string
          rep_hit?: string | null
          rep_level?: string | null
          rep_level2?: string | null
          result?: string | null
          result_note?: string | null
          started_at?: string
          tenant_id: string
        }
        Update: {
          agent_display_name?: string | null
          agent_id?: string | null
          appo_detail?: string | null
          audio_r2_key?: string | null
          audio_url?: string | null
          category?: string | null
          cl?: string | null
          created_at?: string
          custom_data?: Json
          customer_id?: string
          day_of_week?: string | null
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          fm_record_id?: string | null
          fm_synced_at?: string | null
          id?: string
          lead_id?: string
          rep_hit?: string | null
          rep_level?: string | null
          rep_level2?: string | null
          result?: string | null
          result_note?: string | null
          started_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_with_customer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          business_end_time: string | null
          business_start_time: string | null
          company_name: string | null
          created_at: string
          custom_data: Json
          customer_code: string
          email: string | null
          first_contacted_at: string | null
          fm_modification_id: string | null
          fm_record_id: string | null
          fm_synced_at: string | null
          homepage_url: string | null
          id: string
          industry: string | null
          last_contacted_at: string | null
          meo_status: Json
          phone_numbers: Json
          prefecture: string | null
          primary_phone: string | null
          regular_holidays: Json
          representative_name: string | null
          tenant_id: string
          title: string | null
          total_deal_amount: number
          total_deal_count: number
          total_lead_count: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_end_time?: string | null
          business_start_time?: string | null
          company_name?: string | null
          created_at?: string
          custom_data?: Json
          customer_code: string
          email?: string | null
          first_contacted_at?: string | null
          fm_modification_id?: string | null
          fm_record_id?: string | null
          fm_synced_at?: string | null
          homepage_url?: string | null
          id?: string
          industry?: string | null
          last_contacted_at?: string | null
          meo_status?: Json
          phone_numbers?: Json
          prefecture?: string | null
          primary_phone?: string | null
          regular_holidays?: Json
          representative_name?: string | null
          tenant_id: string
          title?: string | null
          total_deal_amount?: number
          total_deal_count?: number
          total_lead_count?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_end_time?: string | null
          business_start_time?: string | null
          company_name?: string | null
          created_at?: string
          custom_data?: Json
          customer_code?: string
          email?: string | null
          first_contacted_at?: string | null
          fm_modification_id?: string | null
          fm_record_id?: string | null
          fm_synced_at?: string | null
          homepage_url?: string | null
          id?: string
          industry?: string | null
          last_contacted_at?: string | null
          meo_status?: Json
          phone_numbers?: Json
          prefecture?: string | null
          primary_phone?: string | null
          regular_holidays?: Json
          representative_name?: string | null
          tenant_id?: string
          title?: string | null
          total_deal_amount?: number
          total_deal_count?: number
          total_lead_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          amount: number
          assignee_id: string | null
          closed_at: string | null
          contract_date: string | null
          contract_months: number | null
          created_at: string
          custom_data: Json
          customer_id: string
          expected_close_date: string | null
          first_payment_date: string | null
          fm_record_id: string | null
          fm_synced_at: string | null
          id: string
          initial_amount: number | null
          lead_id: string
          lost_reason: string | null
          monthly_amount: number | null
          next_payment_date: string | null
          payment_method: string | null
          probability: number | null
          product_name: string | null
          stage: string
          start_date: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          assignee_id?: string | null
          closed_at?: string | null
          contract_date?: string | null
          contract_months?: number | null
          created_at?: string
          custom_data?: Json
          customer_id: string
          expected_close_date?: string | null
          first_payment_date?: string | null
          fm_record_id?: string | null
          fm_synced_at?: string | null
          id?: string
          initial_amount?: number | null
          lead_id: string
          lost_reason?: string | null
          monthly_amount?: number | null
          next_payment_date?: string | null
          payment_method?: string | null
          probability?: number | null
          product_name?: string | null
          stage?: string
          start_date?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          assignee_id?: string | null
          closed_at?: string | null
          contract_date?: string | null
          contract_months?: number | null
          created_at?: string
          custom_data?: Json
          customer_id?: string
          expected_close_date?: string | null
          first_payment_date?: string | null
          fm_record_id?: string | null
          fm_synced_at?: string | null
          id?: string
          initial_amount?: number | null
          lead_id?: string
          lost_reason?: string | null
          monthly_amount?: number | null
          next_payment_date?: string | null
          payment_method?: string | null
          probability?: number | null
          product_name?: string | null
          stage?: string
          start_date?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_with_customer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      field_mappings: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          notes: string | null
          source_field: string
          source_type: string
          target_field: string
          target_table: string
          tenant_id: string
          transform_function: string | null
          transform_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          notes?: string | null
          source_field: string
          source_type: string
          target_field: string
          target_table: string
          tenant_id: string
          transform_function?: string | null
          transform_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          notes?: string | null
          source_field?: string
          source_type?: string
          target_field?: string
          target_table?: string
          tenant_id?: string
          transform_function?: string | null
          transform_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fm_sync_log: {
        Row: {
          created_at: string
          error_log: Json | null
          finished_at: string | null
          id: string
          metadata: Json
          records_failed: number
          records_inserted: number
          records_skipped: number
          records_total: number
          records_updated: number
          started_at: string
          status: string
          sync_direction: string
          sync_type: string
          target_layout: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          error_log?: Json | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          records_failed?: number
          records_inserted?: number
          records_skipped?: number
          records_total?: number
          records_updated?: number
          started_at?: string
          status?: string
          sync_direction: string
          sync_type: string
          target_layout?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          error_log?: Json | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          records_failed?: number
          records_inserted?: number
          records_skipped?: number
          records_total?: number
          records_updated?: number
          started_at?: string
          status?: string
          sync_direction?: string
          sync_type?: string
          target_layout?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fm_sync_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fm_sync_queue: {
        Row: {
          attempts: number
          created_at: string
          direction: string
          enabled: boolean
          fm_layout: string | null
          fm_record_id: string | null
          id: string
          last_attempt_at: string | null
          last_error: string | null
          operation: string
          payload: Json
          processed_at: string | null
          status: string
          target_record_id: string
          target_table: string
          tenant_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          direction?: string
          enabled?: boolean
          fm_layout?: string | null
          fm_record_id?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          operation: string
          payload: Json
          processed_at?: string | null
          status?: string
          target_record_id: string
          target_table: string
          tenant_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          direction?: string
          enabled?: boolean
          fm_layout?: string | null
          fm_record_id?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          operation?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          target_record_id?: string
          target_table?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fm_sync_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ad_campaign_id: string | null
          ad_creative_id: string | null
          ad_name: string | null
          assigned_to: string | null
          created_at: string
          custom_data: Json
          customer_id: string
          deal_amount: number | null
          deal_closed_at: string | null
          first_call_at: string | null
          fm_record_id: string | null
          fm_synced_at: string | null
          has_deal: boolean
          id: string
          inquiry_at: string
          inquiry_content: string | null
          last_call_at: string | null
          list_handover_date: string | null
          lost_reason: string | null
          priority_score: number
          recall_date: string | null
          recall_time: string | null
          source: string
          source_data: Json
          status: string
          status_history: Json
          status_locked_at: string | null
          status_locked_by: string | null
          temperature: string
          temperature_reason: string | null
          tenant_id: string
          total_call_count: number
          updated_at: string
        }
        Insert: {
          ad_campaign_id?: string | null
          ad_creative_id?: string | null
          ad_name?: string | null
          assigned_to?: string | null
          created_at?: string
          custom_data?: Json
          customer_id: string
          deal_amount?: number | null
          deal_closed_at?: string | null
          first_call_at?: string | null
          fm_record_id?: string | null
          fm_synced_at?: string | null
          has_deal?: boolean
          id?: string
          inquiry_at: string
          inquiry_content?: string | null
          last_call_at?: string | null
          list_handover_date?: string | null
          lost_reason?: string | null
          priority_score?: number
          recall_date?: string | null
          recall_time?: string | null
          source?: string
          source_data?: Json
          status?: string
          status_history?: Json
          status_locked_at?: string | null
          status_locked_by?: string | null
          temperature?: string
          temperature_reason?: string | null
          tenant_id: string
          total_call_count?: number
          updated_at?: string
        }
        Update: {
          ad_campaign_id?: string | null
          ad_creative_id?: string | null
          ad_name?: string | null
          assigned_to?: string | null
          created_at?: string
          custom_data?: Json
          customer_id?: string
          deal_amount?: number | null
          deal_closed_at?: string | null
          first_call_at?: string | null
          fm_record_id?: string | null
          fm_synced_at?: string | null
          has_deal?: boolean
          id?: string
          inquiry_at?: string
          inquiry_content?: string | null
          last_call_at?: string | null
          list_handover_date?: string | null
          lost_reason?: string | null
          priority_score?: number
          recall_date?: string | null
          recall_time?: string | null
          source?: string
          source_data?: Json
          status?: string
          status_history?: Json
          status_locked_at?: string | null
          status_locked_by?: string | null
          temperature?: string
          temperature_reason?: string | null
          tenant_id?: string
          total_call_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_ad_campaign_id_fkey"
            columns: ["ad_campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_ad_creative_id_fkey"
            columns: ["ad_creative_id"]
            isOneToOne: false
            referencedRelation: "ad_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_status_locked_by_fkey"
            columns: ["status_locked_by"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_definitions: {
        Row: {
          category: string
          created_at: string
          display_order: number
          format_pattern: string | null
          formula: string
          formula_type: string
          id: string
          is_system: boolean
          is_visible: boolean
          label: string
          metadata: Json
          metric_key: string
          tenant_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          display_order?: number
          format_pattern?: string | null
          formula: string
          formula_type: string
          id?: string
          is_system?: boolean
          is_visible?: boolean
          label: string
          metadata?: Json
          metric_key: string
          tenant_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          display_order?: number
          format_pattern?: string | null
          formula?: string
          formula_type?: string
          id?: string
          is_system?: boolean
          is_visible?: boolean
          label?: string
          metadata?: Json
          metric_key?: string
          tenant_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      status_definitions: {
        Row: {
          allowed_next_statuses: string[] | null
          category: string
          color: string | null
          created_at: string
          id: string
          is_completed: boolean
          is_excluded: boolean
          is_system: boolean
          is_won: boolean
          label: string
          order_index: number
          status_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allowed_next_statuses?: string[] | null
          category: string
          color?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          is_excluded?: boolean
          is_system?: boolean
          is_won?: boolean
          label: string
          order_index?: number
          status_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allowed_next_statuses?: string[] | null
          category?: string
          color?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          is_excluded?: boolean
          is_system?: boolean
          is_won?: boolean
          label?: string
          order_index?: number
          status_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          clerk_user_id: string
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: string
          tenant_id: string
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string
          tenant_id: string
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_schemas: {
        Row: {
          created_at: string
          field_definitions: Json
          id: string
          target_table: string
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          field_definitions?: Json
          id?: string
          target_table: string
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          field_definitions?: Json
          id?: string
          target_table?: string
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_schemas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          clerk_org_id: string
          created_at: string
          id: string
          mode: string
          name: string
          settings: Json
          updated_at: string
        }
        Insert: {
          clerk_org_id: string
          created_at?: string
          id?: string
          mode?: string
          name: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          clerk_org_id?: string
          created_at?: string
          id?: string
          mode?: string
          name?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          filters: Json
          id: string
          member_id: string
          preferences: Json
          tenant_id: string
          updated_at: string
          visible_columns: Json
          visible_metrics: Json
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          member_id: string
          preferences?: Json
          tenant_id: string
          updated_at?: string
          visible_columns?: Json
          visible_metrics?: Json
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          member_id?: string
          preferences?: Json
          tenant_id?: string
          updated_at?: string
          visible_columns?: Json
          visible_metrics?: Json
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_call_full: {
        Row: {
          ad_campaign_id: string | null
          ad_creative_id: string | null
          agent_display_name: string | null
          agent_id: string | null
          appo_detail: string | null
          audio_r2_key: string | null
          audio_url: string | null
          category: string | null
          cl: string | null
          company_name: string | null
          created_at: string | null
          custom_data: Json | null
          customer_code: string | null
          customer_id: string | null
          day_of_week: string | null
          direction: string | null
          duration_seconds: number | null
          ended_at: string | null
          fm_record_id: string | null
          fm_synced_at: string | null
          id: string | null
          lead_id: string | null
          lead_source: string | null
          lead_status: string | null
          rep_hit: string | null
          rep_level: string | null
          rep_level2: string | null
          representative_name: string | null
          result: string | null
          result_note: string | null
          started_at: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_with_customer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_ad_campaign_id_fkey"
            columns: ["ad_campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_ad_creative_id_fkey"
            columns: ["ad_creative_id"]
            isOneToOne: false
            referencedRelation: "ad_creatives"
            referencedColumns: ["id"]
          },
        ]
      }
      v_lead_with_customer: {
        Row: {
          ad_campaign_id: string | null
          ad_creative_id: string | null
          ad_name: string | null
          assigned_to: string | null
          company_name: string | null
          created_at: string | null
          custom_data: Json | null
          customer_code: string | null
          customer_id: string | null
          deal_amount: number | null
          deal_closed_at: string | null
          email: string | null
          first_call_at: string | null
          fm_record_id: string | null
          fm_synced_at: string | null
          has_deal: boolean | null
          id: string | null
          industry: string | null
          inquiry_at: string | null
          inquiry_content: string | null
          last_call_at: string | null
          list_handover_date: string | null
          lost_reason: string | null
          prefecture: string | null
          primary_phone: string | null
          priority_score: number | null
          recall_date: string | null
          recall_time: string | null
          representative_name: string | null
          source: string | null
          source_data: Json | null
          status: string | null
          status_history: Json | null
          status_locked_at: string | null
          status_locked_by: string | null
          temperature: string | null
          temperature_reason: string | null
          tenant_id: string | null
          total_call_count: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_ad_campaign_id_fkey"
            columns: ["ad_campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_ad_creative_id_fkey"
            columns: ["ad_creative_id"]
            isOneToOne: false
            referencedRelation: "ad_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_status_locked_by_fkey"
            columns: ["status_locked_by"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_ad_cohort_metrics: {
        Args: {
          p_campaign_id?: string
          p_lookahead_months?: number
          p_tenant_id?: string
        }
        Returns: {
          campaign_id: string
          cohort_month: string
          creative_id: string
          leads_count: number
          m0_amount: number
          m0_apo: number
          m0_seat: number
          m0_won: number
          m1_amount: number
          m1_apo: number
          m1_seat: number
          m1_won: number
          m2_amount: number
          m2_apo: number
          m2_seat: number
          m2_won: number
          m3_amount: number
          m3_apo: number
          m3_seat: number
          m3_won: number
        }[]
      }
      get_ad_roi: {
        Args: {
          p_distinct_customers?: boolean
          p_period_end?: string
          p_period_start?: string
          p_tenant_id?: string
        }
        Returns: {
          apo_count: number
          campaign_id: string
          campaign_name: string
          clicks: number
          cpa: number
          cpc: number
          cpm: number
          cpo: number
          creative_id: string
          creative_name: string
          impressions: number
          leads_count: number
          platform: string
          roas: number
          spend: number
          won_amount: number
          won_count: number
        }[]
      }
      get_ad_roi_adset_daily: {
        Args: {
          p_distinct_customers?: boolean
          p_period_end?: string
          p_period_start?: string
          p_tenant_id?: string
        }
        Returns: {
          spend_date: string
          platform: string
          campaign_id: string
          campaign_name: string
          campaign_db_id: string
          ad_set_id: string
          ad_set_name: string
          ad_set_db_id: string
          spend: number
          impressions: number
          clicks: number
          leads_count: number
          apo_count: number
          won_count: number
          won_amount: number
          roas: number
          cpo: number
          cpa: number
          cpc: number
          cpm: number
        }[]
      }
      get_current_tenant_id: { Args: never; Returns: string }
      get_customer_ltv: {
        Args: { p_customer_id?: string; p_tenant_id?: string }
        Returns: {
          call_count: number
          company_name: string
          customer_code: string
          customer_id: string
          deal_count: number
          first_contact: string
          last_contact: string
          lead_count: number
          ltv_months: number
          total_amount: number
        }[]
      }
      get_tenant_kpi: {
        Args: {
          p_period_end?: string
          p_period_start?: string
          p_tenant_id?: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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

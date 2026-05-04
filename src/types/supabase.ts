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
          visible: boolean
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
          visible?: boolean
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
          visible?: boolean
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
          visible: boolean
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
          visible?: boolean
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
          visible?: boolean
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
      ad_sets: {
        Row: {
          campaign_id: string
          created_at: string
          external_id: string
          id: string
          name: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          external_id: string
          id?: string
          name: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          external_id?: string
          id?: string
          name?: string
          status?: string
          tenant_id?: string
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
          id: string
          last_synced_date: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          last_synced_date?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          last_synced_date?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_sync_state_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
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
          agent_id: string | null
          agent_name: string | null
          appo_detail: string | null
          audio_r2_key: string | null
          call_category: string | null
          call_date: string
          call_duration_minutes: number | null
          call_duration_seconds: number | null
          call_end_date: string | null
          call_end_time: string | null
          call_history_id: string | null
          call_number: number
          call_result: string | null
          call_start_time: string | null
          called_at: string | null
          ci: string | null
          claris_id: string | null
          created_at: string
          custom_data: Json
          direction: string
          duration_seconds: number | null
          fm_modification_id: string | null
          fm_record_id: string | null
          hidden_flag: string | null
          id: string
          inquiry_date: string | null
          lead_id: string | null
          list_name: string | null
          list_record_id: string
          list_source: string | null
          reissue_pending: string | null
          rep_hit: string | null
          rep_level: string | null
          rep_level2: string | null
          tenant_id: string
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          appo_detail?: string | null
          audio_r2_key?: string | null
          call_category?: string | null
          call_date?: string
          call_duration_minutes?: number | null
          call_duration_seconds?: number | null
          call_end_date?: string | null
          call_end_time?: string | null
          call_history_id?: string | null
          call_number?: number
          call_result?: string | null
          call_start_time?: string | null
          called_at?: string | null
          ci?: string | null
          claris_id?: string | null
          created_at?: string
          custom_data?: Json
          direction?: string
          duration_seconds?: number | null
          fm_modification_id?: string | null
          fm_record_id?: string | null
          hidden_flag?: string | null
          id?: string
          inquiry_date?: string | null
          lead_id?: string | null
          list_name?: string | null
          list_record_id: string
          list_source?: string | null
          reissue_pending?: string | null
          rep_hit?: string | null
          rep_level?: string | null
          rep_level2?: string | null
          tenant_id: string
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          appo_detail?: string | null
          audio_r2_key?: string | null
          call_category?: string | null
          call_date?: string
          call_duration_minutes?: number | null
          call_duration_seconds?: number | null
          call_end_date?: string | null
          call_end_time?: string | null
          call_history_id?: string | null
          call_number?: number
          call_result?: string | null
          call_start_time?: string | null
          called_at?: string | null
          ci?: string | null
          claris_id?: string | null
          created_at?: string
          custom_data?: Json
          direction?: string
          duration_seconds?: number | null
          fm_modification_id?: string | null
          fm_record_id?: string | null
          hidden_flag?: string | null
          id?: string
          inquiry_date?: string | null
          lead_id?: string | null
          list_name?: string | null
          list_record_id?: string
          list_source?: string | null
          reissue_pending?: string | null
          rep_hit?: string | null
          rep_level?: string | null
          rep_level2?: string | null
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
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_list_record_id_fkey"
            columns: ["list_record_id"]
            isOneToOne: false
            referencedRelation: "list_records"
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
      csv_import_temp: {
        Row: {
          "980円プランに加え、集客効果を高めるための追": string | null
          phone_number: string | null
          "Web集客全般（MEOやHP等）の売上アップ提案を受": string | null
          コール数: string | null
          "サービスの導入や予算に関して、決裁権をお持": string | null
          メール: string | null
          代表名: string | null
          会社名: string | null
          再日: string | null
          再時間: string | null
          最終架電結果: string | null
          初期: string | null
          受注: string | null
          問い合わせ日: string | null
          契約月数: string | null
          完了進捗: string | null
          "導入検討とご案内のため【オンラインで60分程": string | null
          市区: string | null
          広告名: string | null
          役職: string | null
          採用NG: string | null
          採用OK: string | null
          月額: string | null
          県名: string | null
          総受注額: string | null
          詳細: string | null
          調整中: string | null
          "電話番号（81変換）": string | null
        }
        Insert: {
          "980円プランに加え、集客効果を高めるための追"?: string | null
          phone_number?: string | null
          "Web集客全般（MEOやHP等）の売上アップ提案を受"?: string | null
          コール数?: string | null
          "サービスの導入や予算に関して、決裁権をお持"?: string | null
          メール?: string | null
          代表名?: string | null
          会社名?: string | null
          再日?: string | null
          再時間?: string | null
          最終架電結果?: string | null
          初期?: string | null
          受注?: string | null
          問い合わせ日?: string | null
          契約月数?: string | null
          完了進捗?: string | null
          "導入検討とご案内のため【オンラインで60分程"?: string | null
          市区?: string | null
          広告名?: string | null
          役職?: string | null
          採用NG?: string | null
          採用OK?: string | null
          月額?: string | null
          県名?: string | null
          総受注額?: string | null
          詳細?: string | null
          調整中?: string | null
          "電話番号（81変換）"?: string | null
        }
        Update: {
          "980円プランに加え、集客効果を高めるための追"?: string | null
          phone_number?: string | null
          "Web集客全般（MEOやHP等）の売上アップ提案を受"?: string | null
          コール数?: string | null
          "サービスの導入や予算に関して、決裁権をお持"?: string | null
          メール?: string | null
          代表名?: string | null
          会社名?: string | null
          再日?: string | null
          再時間?: string | null
          最終架電結果?: string | null
          初期?: string | null
          受注?: string | null
          問い合わせ日?: string | null
          契約月数?: string | null
          完了進捗?: string | null
          "導入検討とご案内のため【オンラインで60分程"?: string | null
          市区?: string | null
          広告名?: string | null
          役職?: string | null
          採用NG?: string | null
          採用OK?: string | null
          月額?: string | null
          県名?: string | null
          総受注額?: string | null
          詳細?: string | null
          調整中?: string | null
          "電話番号（81変換）"?: string | null
        }
        Relationships: []
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
          adjusting: boolean | null
          adset_id: string | null
          appo_at: string | null
          assigned_to: string | null
          call_count: string | null
          city: string | null
          company_name: string | null
          completion_progress: string | null
          contract_months: string | null
          created_at: string
          csv_row_number: number | null
          custom_data: Json
          customer_id: string | null
          deal_amount: number | null
          deal_closed_at: string | null
          email_address: string | null
          first_call_at: string | null
          fm_record_id: string | null
          fm_synced_at: string | null
          form_q1: string | null
          form_q2: string | null
          form_q3: string | null
          form_q4: string | null
          has_deal: boolean
          ichiyou_ng: boolean | null
          id: string
          imported_from_csv: boolean | null
          initial_fee: string | null
          inquiry_at: string
          inquiry_content: string | null
          inquiry_date: string | null
          inquiry_date_1: string | null
          inquiry_datetime_raw: string | null
          jitsuyo_ok: boolean | null
          last_call_at: string | null
          last_call_result: string | null
          lead_detail: string | null
          list_handover_date: string | null
          list_record_id: string | null
          lost_reason: string | null
          monthly_fee: string | null
          order_closed: boolean | null
          phone_number: string | null
          prefecture: string | null
          priority_score: number
          recall_date: string | null
          recall_time: string | null
          rep_title: string | null
          representative_name: string | null
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
          total_revenue: string | null
          updated_at: string
          webhook_lead_id: string | null
        }
        Insert: {
          ad_campaign_id?: string | null
          ad_creative_id?: string | null
          ad_name?: string | null
          adjusting?: boolean | null
          adset_id?: string | null
          appo_at?: string | null
          assigned_to?: string | null
          call_count?: string | null
          city?: string | null
          company_name?: string | null
          completion_progress?: string | null
          contract_months?: string | null
          created_at?: string
          csv_row_number?: number | null
          custom_data?: Json
          customer_id?: string | null
          deal_amount?: number | null
          deal_closed_at?: string | null
          email_address?: string | null
          first_call_at?: string | null
          fm_record_id?: string | null
          fm_synced_at?: string | null
          form_q1?: string | null
          form_q2?: string | null
          form_q3?: string | null
          form_q4?: string | null
          has_deal?: boolean
          ichiyou_ng?: boolean | null
          id?: string
          imported_from_csv?: boolean | null
          initial_fee?: string | null
          inquiry_at: string
          inquiry_content?: string | null
          inquiry_date?: string | null
          inquiry_date_1?: string | null
          inquiry_datetime_raw?: string | null
          jitsuyo_ok?: boolean | null
          last_call_at?: string | null
          last_call_result?: string | null
          lead_detail?: string | null
          list_handover_date?: string | null
          list_record_id?: string | null
          lost_reason?: string | null
          monthly_fee?: string | null
          order_closed?: boolean | null
          phone_number?: string | null
          prefecture?: string | null
          priority_score?: number
          recall_date?: string | null
          recall_time?: string | null
          rep_title?: string | null
          representative_name?: string | null
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
          total_revenue?: string | null
          updated_at?: string
          webhook_lead_id?: string | null
        }
        Update: {
          ad_campaign_id?: string | null
          ad_creative_id?: string | null
          ad_name?: string | null
          adjusting?: boolean | null
          adset_id?: string | null
          appo_at?: string | null
          assigned_to?: string | null
          call_count?: string | null
          city?: string | null
          company_name?: string | null
          completion_progress?: string | null
          contract_months?: string | null
          created_at?: string
          csv_row_number?: number | null
          custom_data?: Json
          customer_id?: string | null
          deal_amount?: number | null
          deal_closed_at?: string | null
          email_address?: string | null
          first_call_at?: string | null
          fm_record_id?: string | null
          fm_synced_at?: string | null
          form_q1?: string | null
          form_q2?: string | null
          form_q3?: string | null
          form_q4?: string | null
          has_deal?: boolean
          ichiyou_ng?: boolean | null
          id?: string
          imported_from_csv?: boolean | null
          initial_fee?: string | null
          inquiry_at?: string
          inquiry_content?: string | null
          inquiry_date?: string | null
          inquiry_date_1?: string | null
          inquiry_datetime_raw?: string | null
          jitsuyo_ok?: boolean | null
          last_call_at?: string | null
          last_call_result?: string | null
          lead_detail?: string | null
          list_handover_date?: string | null
          list_record_id?: string | null
          lost_reason?: string | null
          monthly_fee?: string | null
          order_closed?: boolean | null
          phone_number?: string | null
          prefecture?: string | null
          priority_score?: number
          recall_date?: string | null
          recall_time?: string | null
          rep_title?: string | null
          representative_name?: string | null
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
          total_revenue?: string | null
          updated_at?: string
          webhook_lead_id?: string | null
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
          {
            foreignKeyName: "leads_webhook_lead_id_fkey"
            columns: ["webhook_lead_id"]
            isOneToOne: false
            referencedRelation: "webhook_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      list_records: {
        Row: {
          ad_name: string | null
          address: string | null
          assigned_to: string | null
          business_end_time: string | null
          business_start_time: string | null
          case_memo: string | null
          company_email: string | null
          company_name: string | null
          created_at: string
          custom_data: Json
          customer_id: string | null
          deal_amount: number | null
          deal_closed_at: string | null
          fm_modification_id: string | null
          fm_record_id: string | null
          homepage_exists: string | null
          homepage_url: string | null
          id: string
          industry: string | null
          inquiry_count: number | null
          last_call_agent: string | null
          last_call_appo_detail: string | null
          last_call_category: string | null
          last_call_count: number
          last_call_date: string | null
          last_call_end_time: string | null
          last_call_list_name: string | null
          last_call_rep_level: string | null
          last_call_rep_level2: string | null
          last_call_result: string | null
          last_call_start_time: string | null
          last_inquiry_ad_name: string | null
          last_inquiry_at: string | null
          list_created_at: string | null
          list_handover_date: string | null
          list_name: string | null
          list_screening: string | null
          lost_reason: string | null
          meeting_date: string | null
          meeting_time: string | null
          meo_status: Json
          newcomer_flag: string | null
          phone_numbers: Json
          pre_setup_agent: string | null
          pre_setup_date: string | null
          prefecture: string | null
          priority_score: number
          recall_date: string | null
          recall_time: string | null
          regular_holidays: Json
          representative_name: string | null
          sales_agent: string | null
          source: string | null
          source_data: Json
          status: string
          temperature: string
          temperature_reason: string | null
          tenant_id: string
          title: string | null
          updated_at: string
          webhook_lead_id: string | null
          zoom_url: string | null
        }
        Insert: {
          ad_name?: string | null
          address?: string | null
          assigned_to?: string | null
          business_end_time?: string | null
          business_start_time?: string | null
          case_memo?: string | null
          company_email?: string | null
          company_name?: string | null
          created_at?: string
          custom_data?: Json
          customer_id?: string | null
          deal_amount?: number | null
          deal_closed_at?: string | null
          fm_modification_id?: string | null
          fm_record_id?: string | null
          homepage_exists?: string | null
          homepage_url?: string | null
          id?: string
          industry?: string | null
          inquiry_count?: number | null
          last_call_agent?: string | null
          last_call_appo_detail?: string | null
          last_call_category?: string | null
          last_call_count?: number
          last_call_date?: string | null
          last_call_end_time?: string | null
          last_call_list_name?: string | null
          last_call_rep_level?: string | null
          last_call_rep_level2?: string | null
          last_call_result?: string | null
          last_call_start_time?: string | null
          last_inquiry_ad_name?: string | null
          last_inquiry_at?: string | null
          list_created_at?: string | null
          list_handover_date?: string | null
          list_name?: string | null
          list_screening?: string | null
          lost_reason?: string | null
          meeting_date?: string | null
          meeting_time?: string | null
          meo_status?: Json
          newcomer_flag?: string | null
          phone_numbers?: Json
          pre_setup_agent?: string | null
          pre_setup_date?: string | null
          prefecture?: string | null
          priority_score?: number
          recall_date?: string | null
          recall_time?: string | null
          regular_holidays?: Json
          representative_name?: string | null
          sales_agent?: string | null
          source?: string | null
          source_data?: Json
          status?: string
          temperature?: string
          temperature_reason?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string
          webhook_lead_id?: string | null
          zoom_url?: string | null
        }
        Update: {
          ad_name?: string | null
          address?: string | null
          assigned_to?: string | null
          business_end_time?: string | null
          business_start_time?: string | null
          case_memo?: string | null
          company_email?: string | null
          company_name?: string | null
          created_at?: string
          custom_data?: Json
          customer_id?: string | null
          deal_amount?: number | null
          deal_closed_at?: string | null
          fm_modification_id?: string | null
          fm_record_id?: string | null
          homepage_exists?: string | null
          homepage_url?: string | null
          id?: string
          industry?: string | null
          inquiry_count?: number | null
          last_call_agent?: string | null
          last_call_appo_detail?: string | null
          last_call_category?: string | null
          last_call_count?: number
          last_call_date?: string | null
          last_call_end_time?: string | null
          last_call_list_name?: string | null
          last_call_rep_level?: string | null
          last_call_rep_level2?: string | null
          last_call_result?: string | null
          last_call_start_time?: string | null
          last_inquiry_ad_name?: string | null
          last_inquiry_at?: string | null
          list_created_at?: string | null
          list_handover_date?: string | null
          list_name?: string | null
          list_screening?: string | null
          lost_reason?: string | null
          meeting_date?: string | null
          meeting_time?: string | null
          meo_status?: Json
          newcomer_flag?: string | null
          phone_numbers?: Json
          pre_setup_agent?: string | null
          pre_setup_date?: string | null
          prefecture?: string | null
          priority_score?: number
          recall_date?: string | null
          recall_time?: string | null
          regular_holidays?: Json
          representative_name?: string | null
          sales_agent?: string | null
          source?: string | null
          source_data?: Json
          status?: string
          temperature?: string
          temperature_reason?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string
          webhook_lead_id?: string | null
          zoom_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_records_webhook_lead_id_fkey"
            columns: ["webhook_lead_id"]
            isOneToOne: false
            referencedRelation: "webhook_leads"
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
      sync_logs: {
        Row: {
          errors: number | null
          id: string
          meta: Json | null
          records_synced: number | null
          synced_at: string
          tenant_id: string | null
          type: string
        }
        Insert: {
          errors?: number | null
          id?: string
          meta?: Json | null
          records_synced?: number | null
          synced_at?: string
          tenant_id?: string | null
          type: string
        }
        Update: {
          errors?: number | null
          id?: string
          meta?: Json | null
          records_synced?: number | null
          synced_at?: string
          tenant_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_tenant_id_fkey"
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
      webhook_leads: {
        Row: {
          ad_name: string | null
          added_at: string | null
          added_to_list_id: string | null
          created_at: string
          id: string
          mapped_data: Json
          match_status: string | null
          phone_normalized: string | null
          raw_data: Json
          received_at: string
          source: string
          status: string
          tenant_id: string
        }
        Insert: {
          ad_name?: string | null
          added_at?: string | null
          added_to_list_id?: string | null
          created_at?: string
          id?: string
          mapped_data?: Json
          match_status?: string | null
          phone_normalized?: string | null
          raw_data?: Json
          received_at?: string
          source?: string
          status?: string
          tenant_id: string
        }
        Update: {
          ad_name?: string | null
          added_at?: string | null
          added_to_list_id?: string | null
          created_at?: string
          id?: string
          mapped_data?: Json
          match_status?: string | null
          phone_normalized?: string | null
          raw_data?: Json
          received_at?: string
          source?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_customer_id: { Args: { p_tenant_id: string }; Returns: string }
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
          ad_set_db_id: string
          ad_set_id: string
          ad_set_name: string
          apo_count: number
          campaign_db_id: string
          campaign_id: string
          campaign_name: string
          clicks: number
          cpa: number
          cpc: number
          cpm: number
          cpo: number
          impressions: number
          leads_count: number
          platform: string
          reach: number
          roas: number
          spend: number
          spend_date: string
          won_amount: number
          won_count: number
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
      get_lead_stats_by_adset: {
        Args: { from_date?: string; target_tenant_id: string; to_date?: string }
        Returns: {
          adset_id: string
          appo_ok_count: number
          appo_rate: number
          order_count: number
          order_rate: number
          total_leads: number
          total_revenue: number
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

// Типы базы. Сгенерированы Supabase (generate_typescript_types) после миграции 0010,
// убраны служебные связи с представлением и сложные вспомогательные типы.
// Не править руками: после новой миграции сгенерировать заново.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_reviews: {
        Row: {
          checks: Json
          confidence: number | null
          created_at: string
          explanation: string | null
          id: string
          master_reason: string | null
          master_score: number | null
          order_id: string
          score: number | null
          source: Database["public"]["Enums"]["ai_source"]
          verdict: Database["public"]["Enums"]["ai_verdict"]
        }
        Insert: {
          checks?: Json
          confidence?: number | null
          created_at?: string
          explanation?: string | null
          id?: string
          master_reason?: string | null
          master_score?: number | null
          order_id: string
          score?: number | null
          source: Database["public"]["Enums"]["ai_source"]
          verdict: Database["public"]["Enums"]["ai_verdict"]
        }
        Update: {
          checks?: Json
          confidence?: number | null
          created_at?: string
          explanation?: string | null
          id?: string
          master_reason?: string | null
          master_score?: number | null
          order_id?: string
          score?: number | null
          source?: Database["public"]["Enums"]["ai_source"]
          verdict?: Database["public"]["Enums"]["ai_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "ai_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          auth_user_id: string | null
          brigade: string | null
          full_name: string
          grade: number | null
          id: string
          login: string
          on_shift: boolean
          permits: string[]
          role: Database["public"]["Enums"]["employee_role"]
          shift: string | null
          specialty: string | null
          telegram_chat_id: number | null
          telegram_link_code: string | null
        }
        Insert: {
          auth_user_id?: string | null
          brigade?: string | null
          full_name: string
          grade?: number | null
          id?: string
          login: string
          on_shift?: boolean
          permits?: string[]
          role: Database["public"]["Enums"]["employee_role"]
          shift?: string | null
          specialty?: string | null
          telegram_chat_id?: number | null
          telegram_link_code?: string | null
        }
        Update: {
          auth_user_id?: string | null
          brigade?: string | null
          full_name?: string
          grade?: number | null
          id?: string
          login?: string
          on_shift?: boolean
          permits?: string[]
          role?: Database["public"]["Enums"]["employee_role"]
          shift?: string | null
          specialty?: string | null
          telegram_chat_id?: number | null
          telegram_link_code?: string | null
        }
        Relationships: []
      }
      equipment: {
        Row: {
          criticality: number
          id: string
          inventory_no: string
          name: string
          qr_code: string | null
          section_id: string
          type: string
        }
        Insert: {
          criticality?: number
          id?: string
          inventory_no: string
          name: string
          qr_code?: string | null
          section_id: string
          type: string
        }
        Update: {
          criticality?: number
          id?: string
          inventory_no?: string
          name?: string
          qr_code?: string | null
          section_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      fault_codes: {
        Row: {
          category: string
          code: string
          name: string
          norm_hours: number
        }
        Insert: {
          category: string
          code: string
          name: string
          norm_hours: number
        }
        Update: {
          category?: string
          code?: string
          name?: string
          norm_hours?: number
        }
        Relationships: []
      }
      material_usages: {
        Row: {
          id: string
          material_id: string
          order_id: string
          qty: number
        }
        Insert: {
          id?: string
          material_id: string
          order_id: string
          qty: number
        }
        Update: {
          id?: string
          material_id?: string
          order_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_usages_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_usages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          fault_codes: string[]
          id: string
          name: string
          typical_qty: number
          unit: string
        }
        Insert: {
          fault_codes?: string[]
          id?: string
          name: string
          typical_qty?: number
          unit: string
        }
        Update: {
          fault_codes?: string[]
          id?: string
          name?: string
          typical_qty?: number
          unit?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          employee_id: string
          quiet_from: string | null
          quiet_to: string | null
          telegram_off_kinds: Database["public"]["Enums"]["notification_kind"][]
          updated_at: string
        }
        Insert: {
          employee_id: string
          quiet_from?: string | null
          quiet_to?: string | null
          telegram_off_kinds?: Database["public"]["Enums"]["notification_kind"][]
          updated_at?: string
        }
        Update: {
          employee_id?: string
          quiet_from?: string | null
          quiet_to?: string | null
          telegram_off_kinds?: Database["public"]["Enums"]["notification_kind"][]
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          delivered: boolean
          employee_id: string
          error: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          order_id: string | null
          read_at: string | null
          text: string
        }
        Insert: {
          created_at?: string
          delivered: boolean
          employee_id: string
          error?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          order_id?: string | null
          read_at?: string | null
          text: string
        }
        Update: {
          created_at?: string
          delivered?: boolean
          employee_id?: string
          error?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          order_id?: string | null
          read_at?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_templates: {
        Row: {
          description: string
          fault_code: string | null
          id: string
          name: string
          norm_hours: number | null
          type: Database["public"]["Enums"]["order_type"]
        }
        Insert: {
          description: string
          fault_code?: string | null
          id?: string
          name: string
          norm_hours?: number | null
          type?: Database["public"]["Enums"]["order_type"]
        }
        Update: {
          description?: string
          fault_code?: string | null
          id?: string
          name?: string
          norm_hours?: number | null
          type?: Database["public"]["Enums"]["order_type"]
        }
        Relationships: [
          {
            foreignKeyName: "order_templates_fault_code_fkey"
            columns: ["fault_code"]
            isOneToOne: false
            referencedRelation: "fault_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      photos: {
        Row: {
          author_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["photo_kind"]
          order_id: string
          path: string
          phash: string | null
          sha256: string | null
          taken_at: string | null
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["photo_kind"]
          order_id: string
          path: string
          phash?: string | null
          sha256?: string | null
          taken_at?: string | null
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["photo_kind"]
          order_id?: string
          path?: string
          phash?: string | null
          sha256?: string | null
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      report_snapshots: {
        Row: {
          ai_source: string | null
          ai_text: Json | null
          computed_at: string
          id: string
          kind: string
          payload: Json
          scope: string
        }
        Insert: {
          ai_source?: string | null
          ai_text?: Json | null
          computed_at?: string
          id?: string
          kind: string
          payload: Json
          scope?: string
        }
        Update: {
          ai_source?: string | null
          ai_text?: Json | null
          computed_at?: string
          id?: string
          kind?: string
          payload?: Json
          scope?: string
        }
        Relationships: []
      }
      requests: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          equipment_id: string | null
          id: string
          device_id: string | null
          dismiss_reason: string | null
          machine_state: string | null
          number: number
          order_id: string | null
          parent_order_id: string | null
          photo_path: string | null
          reporter_name: string | null
          section_id: string | null
          status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          equipment_id?: string | null
          id?: string
          device_id?: string | null
          dismiss_reason?: string | null
          machine_state?: string | null
          number?: number
          order_id?: string | null
          parent_order_id?: string | null
          photo_path?: string | null
          reporter_name?: string | null
          section_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          equipment_id?: string | null
          id?: string
          device_id?: string | null
          dismiss_reason?: string | null
          machine_state?: string | null
          number?: number
          order_id?: string | null
          parent_order_id?: string | null
          photo_path?: string | null
          reporter_name?: string | null
          section_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          id: string
          name: string
          qr_code: string | null
        }
        Insert: {
          id?: string
          name: string
          qr_code?: string | null
        }
        Update: {
          id?: string
          name?: string
          qr_code?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          accept_timeout_min: number
          accept_timeout_urgent_min: number
          ai_provider: string
          id: number
          remind_before_min: number
          overdue_repeat_min: number
          lead_escalate_after_min: number
          ai_confidence_threshold: number
        }
        Insert: {
          accept_timeout_min?: number
          accept_timeout_urgent_min?: number
          ai_provider?: string
          id?: number
          remind_before_min?: number
          overdue_repeat_min?: number
          lead_escalate_after_min?: number
          ai_confidence_threshold?: number
        }
        Update: {
          accept_timeout_min?: number
          accept_timeout_urgent_min?: number
          ai_provider?: string
          id?: number
          remind_before_min?: number
          overdue_repeat_min?: number
          lead_escalate_after_min?: number
          ai_confidence_threshold?: number
        }
        Relationships: []
      }
      work_order_events: {
        Row: {
          action: string
          actor_id: string | null
          client_action_id: string | null
          comment: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          order_id: string
          reason: string | null
          reason_code: string | null
          to_status: Database["public"]["Enums"]["order_status"] | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          client_action_id?: string | null
          comment?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          order_id: string
          reason?: string | null
          reason_code?: string | null
          to_status?: Database["public"]["Enums"]["order_status"] | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          client_action_id?: string | null
          comment?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          order_id?: string
          reason?: string | null
          reason_code?: string | null
          to_status?: Database["public"]["Enums"]["order_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "work_order_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          accepted_at: string | null
          assignee_id: string | null
          brigade: string | null
          close_comment: string | null
          closed_at: string | null
          comment: string | null
          created_at: string
          description: string
          done_at: string | null
          due_at: string
          equipment_id: string
          fault_code: string | null
          id: string
          master_id: string
          needs_permit: boolean
          number: number
          parent_order_id: string | null
          priority: Database["public"]["Enums"]["order_priority"]
          request_id: string | null
          section_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          type: Database["public"]["Enums"]["order_type"]
          updated_at: string
          work_done: string | null
        }
        Insert: {
          accepted_at?: string | null
          assignee_id?: string | null
          brigade?: string | null
          close_comment?: string | null
          closed_at?: string | null
          comment?: string | null
          created_at?: string
          description: string
          done_at?: string | null
          due_at: string
          equipment_id: string
          fault_code?: string | null
          id?: string
          master_id: string
          needs_permit?: boolean
          number?: never
          parent_order_id?: string | null
          priority: Database["public"]["Enums"]["order_priority"]
          request_id?: string | null
          section_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          type: Database["public"]["Enums"]["order_type"]
          updated_at?: string
          work_done?: string | null
        }
        Update: {
          accepted_at?: string | null
          assignee_id?: string | null
          brigade?: string | null
          close_comment?: string | null
          closed_at?: string | null
          comment?: string | null
          created_at?: string
          description?: string
          done_at?: string | null
          due_at?: string
          equipment_id?: string
          fault_code?: string | null
          id?: string
          master_id?: string
          needs_permit?: boolean
          number?: never
          parent_order_id?: string | null
          priority?: Database["public"]["Enums"]["order_priority"]
          request_id?: string | null
          section_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          type?: Database["public"]["Enums"]["order_type"]
          updated_at?: string
          work_done?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_fault_code_fkey"
            columns: ["fault_code"]
            isOneToOne: false
            referencedRelation: "fault_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "work_orders_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      worker_board: {
        Row: {
          board_status: string | null
          brigade: string | null
          current_order_id: string | null
          current_order_number: number | null
          current_order_status: Database["public"]["Enums"]["order_status"] | null
          full_name: string | null
          grade: number | null
          id: string | null
          on_shift: boolean | null
          pending_count: number | null
          queue_count: number | null
          specialty: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      change_order_priority: {
        Args: {
          p_client_action_id?: string
          p_order_id: string
          p_priority: Database["public"]["Enums"]["order_priority"]
        }
        Returns: Database["public"]["Enums"]["order_priority"]
      }
      complete_order: {
        Args: {
          p_client_action_id?: string
          p_comment?: string
          p_fault_code: string
          p_materials?: Json
          p_order_id: string
          p_work_done: string
        }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      create_order: {
        Args: {
          p_assignee_id?: string
          p_brigade?: string
          p_client_action_id?: string
          p_comment?: string
          p_description: string
          p_due_at: string
          p_equipment_id: string
          p_fault_code?: string
          p_priority: Database["public"]["Enums"]["order_priority"]
          p_section_id: string
          p_type: Database["public"]["Enums"]["order_type"]
        }
        Returns: string
      }
      decide_request: {
        Args: {
          p_order_id?: string
          p_reason?: string
          p_request_id: string
          p_status: Database["public"]["Enums"]["request_status"]
        }
        Returns: undefined
      }
      equipment_recent_stats: {
        Args: { p_equipment_id: string }
        Returns: {
          breakdowns_30d: number
          downtime_hours: number
          open_orders: number
        }[]
      }
      equipment_repair_history: {
        Args: { p_equipment_id: string; p_exclude_order_id?: string }
        Returns: {
          closed_at: string | null
          fault_code: string | null
          fault_name: string | null
          materials: string | null
          number: number
          work_done: string | null
        }[]
      }
      request_help: {
        Args: { p_client_action_id?: string; p_comment?: string; p_order_id: string }
        Returns: undefined
      }
      resolve_request: {
        Args: { p_request_id: string; p_status: Database["public"]["Enums"]["request_status"] }
        Returns: undefined
      }
      operator_requests_by_device: {
        Args: { p_device_id: string }
        Returns: {
          created_at: string
          description: string
          dismiss_reason: string | null
          equipment_name: string | null
          id: string
          machine_state: string | null
          number: number
          order_number: number | null
          section_name: string | null
          status: Database["public"]["Enums"]["request_status"]
        }[]
      }
      reassign_order: {
        Args: {
          p_assignee_id?: string
          p_brigade?: string
          p_client_action_id?: string
          p_comment?: string
          p_order_id: string
        }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number }
      my_telegram_link: {
        Args: Record<string, never>
        Returns: { link_code: string | null; linked: boolean }[]
      }
      restore_demo: {
        Args: Record<string, never>
        Returns: undefined
      }
      unlink_telegram: { Args: Record<string, never>; Returns: undefined }
      update_settings: {
        Args: {
          p_remind_before_min: number
          p_accept_timeout_min: number
          p_accept_timeout_urgent_min: number
          p_overdue_repeat_min: number
          p_lead_escalate_after_min: number
          p_ai_provider: string
        }
        Returns: undefined
      }
      save_notification_prefs: {
        Args: {
          p_quiet_from: string | null
          p_quiet_to: string | null
          p_telegram_off_kinds: Database["public"]["Enums"]["notification_kind"][]
        }
        Returns: undefined
      }
      submit_operator_request: {
        Args: {
          p_author?: string
          p_code: string
          p_description: string
          p_device_id: string
          p_equipment_id?: string
          p_machine_state: string
          p_photo_path?: string
          p_reporter_name: string
        }
        Returns: { id: string; number: number }[]
      }
      set_master_score: {
        Args: {
          p_reason: string
          p_review_id: string
          p_score: number
        }
        Returns: undefined
      }
      transition_order: {
        Args: {
          p_action: string
          p_client_action_id?: string
          p_comment?: string
          p_order_id: string
          p_reason?: string
          p_reason_code?: string
        }
        Returns: Database["public"]["Enums"]["order_status"]
      }
    }
    Enums: {
      ai_source: "laya" | "llm" | "vlm" | "rules"
      ai_verdict: "accept" | "accept_with_note" | "rework" | "needs_master"
      employee_role: "master" | "worker" | "lead" | "operator"
      notification_kind:
        | "new_order"
        | "remind"
        | "overdue"
        | "not_accepted"
        | "lead_overdue"
        | "review_ready"
        | "status_change"
        | "new_request"
      order_priority: "emergency" | "high" | "normal" | "planned"
      order_status:
        | "issued"
        | "accepted"
        | "queued"
        | "rejected"
        | "in_progress"
        | "paused"
        | "done"
        | "ai_review"
        | "rework"
        | "closed"
        | "cancelled"
      order_type: "planned" | "unplanned"
      photo_kind: "before" | "after"
      request_status: "new" | "converted" | "dismissed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

// Строка таблицы или представления: Tables<"work_orders">.
export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

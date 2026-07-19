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
      audit_logs: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          entidade: string | null
          entidade_id: string | null
          id: string
          ip: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      categorias: {
        Row: {
          id: string
          nome: string
          ordem: number
          parent_id: string | null
        }
        Insert: {
          id?: string
          nome: string
          ordem?: number
          parent_id?: string | null
        }
        Update: {
          id?: string
          nome?: string
          ordem?: number
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      cautela_itens: {
        Row: {
          cautela_id: string
          condicao_devolucao: string | null
          created_at: string
          devolvido: boolean
          devolvido_em: string | null
          equipamento_id: string
          id: string
          observacoes_devolucao: string | null
          situacao_pos_devolucao:
            | Database["public"]["Enums"]["situacao_equipamento"]
            | null
        }
        Insert: {
          cautela_id: string
          condicao_devolucao?: string | null
          created_at?: string
          devolvido?: boolean
          devolvido_em?: string | null
          equipamento_id: string
          id?: string
          observacoes_devolucao?: string | null
          situacao_pos_devolucao?:
            | Database["public"]["Enums"]["situacao_equipamento"]
            | null
        }
        Update: {
          cautela_id?: string
          condicao_devolucao?: string | null
          created_at?: string
          devolvido?: boolean
          devolvido_em?: string | null
          equipamento_id?: string
          id?: string
          observacoes_devolucao?: string | null
          situacao_pos_devolucao?:
            | Database["public"]["Enums"]["situacao_equipamento"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "cautela_itens_cautela_id_fkey"
            columns: ["cautela_id"]
            isOneToOne: false
            referencedRelation: "cautelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cautela_itens_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      cautelas: {
        Row: {
          assinatura_entrega: string | null
          assinatura_recebimento: string | null
          companhia_id: string
          created_at: string
          created_by: string | null
          data_saida: string
          finalidade: string | null
          finalizada_em: string | null
          finalizada_por: string | null
          id: string
          militar_responsavel: string
          militar_retirada: string
          numero: string
          observacoes: string | null
          posto_responsavel: string | null
          posto_retirada: string | null
          previsao_devolucao: string | null
          status: Database["public"]["Enums"]["status_cautela"]
          updated_at: string
        }
        Insert: {
          assinatura_entrega?: string | null
          assinatura_recebimento?: string | null
          companhia_id: string
          created_at?: string
          created_by?: string | null
          data_saida?: string
          finalidade?: string | null
          finalizada_em?: string | null
          finalizada_por?: string | null
          id?: string
          militar_responsavel: string
          militar_retirada: string
          numero: string
          observacoes?: string | null
          posto_responsavel?: string | null
          posto_retirada?: string | null
          previsao_devolucao?: string | null
          status?: Database["public"]["Enums"]["status_cautela"]
          updated_at?: string
        }
        Update: {
          assinatura_entrega?: string | null
          assinatura_recebimento?: string | null
          companhia_id?: string
          created_at?: string
          created_by?: string | null
          data_saida?: string
          finalidade?: string | null
          finalizada_em?: string | null
          finalizada_por?: string | null
          id?: string
          militar_responsavel?: string
          militar_retirada?: string
          numero?: string
          observacoes?: string | null
          posto_responsavel?: string | null
          posto_retirada?: string | null
          previsao_devolucao?: string | null
          status?: Database["public"]["Enums"]["status_cautela"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cautelas_companhia_id_fkey"
            columns: ["companhia_id"]
            isOneToOne: false
            referencedRelation: "companhias"
            referencedColumns: ["id"]
          },
        ]
      }
      companhias: {
        Row: {
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      equipamentos: {
        Row: {
          aguarda_guia_pef: boolean
          categoria_id: string | null
          created_at: string
          created_by: string | null
          descricao: string
          foto_url: string | null
          id: string
          localizacao: string | null
          marca: string | null
          modelo: string | null
          notas_auditorio: string | null
          numero_serie: string | null
          observacoes: string | null
          patrimonio: string | null
          situacao: Database["public"]["Enums"]["situacao_equipamento"]
          updated_at: string
        }
        Insert: {
          aguarda_guia_pef?: boolean
          categoria_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao: string
          foto_url?: string | null
          id?: string
          localizacao?: string | null
          marca?: string | null
          modelo?: string | null
          notas_auditorio?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          patrimonio?: string | null
          situacao?: Database["public"]["Enums"]["situacao_equipamento"]
          updated_at?: string
        }
        Update: {
          aguarda_guia_pef?: boolean
          categoria_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string
          foto_url?: string | null
          id?: string
          localizacao?: string | null
          marca?: string | null
          modelo?: string | null
          notas_auditorio?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          patrimonio?: string | null
          situacao?: Database["public"]["Enums"]["situacao_equipamento"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes: {
        Row: {
          cautela_id: string | null
          created_at: string
          descricao: string | null
          equipamento_id: string | null
          id: string
          ip: string | null
          situacao_anterior:
            | Database["public"]["Enums"]["situacao_equipamento"]
            | null
          situacao_nova:
            | Database["public"]["Enums"]["situacao_equipamento"]
            | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          cautela_id?: string | null
          created_at?: string
          descricao?: string | null
          equipamento_id?: string | null
          id?: string
          ip?: string | null
          situacao_anterior?:
            | Database["public"]["Enums"]["situacao_equipamento"]
            | null
          situacao_nova?:
            | Database["public"]["Enums"]["situacao_equipamento"]
            | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          cautela_id?: string | null
          created_at?: string
          descricao?: string | null
          equipamento_id?: string | null
          id?: string
          ip?: string | null
          situacao_anterior?:
            | Database["public"]["Enums"]["situacao_equipamento"]
            | null
          situacao_nova?:
            | Database["public"]["Enums"]["situacao_equipamento"]
            | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_cautela_id_fkey"
            columns: ["cautela_id"]
            isOneToOne: false
            referencedRelation: "cautelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          posto_graduacao: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          posto_graduacao?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          posto_graduacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      finalizar_cautela: {
        Args: { _cautela_id: string; _itens: Json }
        Returns: undefined
      }
      gerar_numero_cautela: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_comandante: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "comandante" | "telefonista"
      situacao_equipamento:
        | "disponivel"
        | "em_cautela"
        | "extraviado"
        | "em_sindicancia"
        | "baixado"
        | "em_manutencao"
      status_cautela: "ativa" | "finalizada" | "cancelada"
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
    Enums: {
      app_role: ["comandante", "telefonista"],
      situacao_equipamento: [
        "disponivel",
        "em_cautela",
        "extraviado",
        "em_sindicancia",
        "baixado",
        "em_manutencao",
      ],
      status_cautela: ["ativa", "finalizada", "cancelada"],
    },
  },
} as const

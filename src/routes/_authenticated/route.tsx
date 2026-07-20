import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/sismat/use-auth";
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarTrigger, SidebarFooter } from "@/components/ui/sidebar";
import { LayoutDashboard, Radio, ClipboardList, FileUp, Users, FileText, ShieldAlert, LogOut, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function PageError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8">
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        Esta página encontrou um problema. Tente novamente ou recarregue.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={reset}>Tentar novamente</Button>
        <Button variant="ghost" onClick={() => window.location.reload()}>Recarregar</Button>
      </div>
      {import.meta.env.DEV && (
        <pre className="text-xs text-destructive max-w-sm overflow-auto">{error.message}</pre>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) throw redirect({ to: "/auth" });
      return { user: data.user };
    } catch (e: any) {
      // Redireciona para /auth se não há sessão; relança qualquer redirect
      if (e?.to) throw e;
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthLayout,
  errorComponent: PageError,
});

const navBase = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/equipamentos", label: "Equipamentos", icon: Radio },
  { to: "/cautelas", label: "Cautelas", icon: ClipboardList },
];
const navAdmin = [
  { to: "/importar", label: "Importar", icon: FileUp },
  { to: "/usuarios", label: "Usuários", icon: Users },
  { to: "/relatorios", label: "Relatórios", icon: FileText },
  { to: "/auditoria", label: "Auditoria", icon: ShieldAlert },
];

function AuthLayout() {
  const { role, fullName, status, loading } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    nav({ to: "/auth", replace: true });
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  // Usuário com cadastro pendente de aprovação
  if (status === "pendente") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sidebar via-primary to-sidebar">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="bg-card rounded-xl shadow-2xl p-8 space-y-4">
            <Clock className="h-14 w-14 text-yellow-500 mx-auto" />
            <h2 className="text-xl font-bold">Cadastro aguardando aprovação</h2>
            <p className="text-sm text-muted-foreground">
              Seu cadastro foi recebido e está aguardando a aprovação do Comandante do Pelotão.
              Você será notificado assim que o acesso for liberado.
            </p>
            <p className="text-xs text-muted-foreground">
              Logado como: <span className="font-medium">{fullName}</span>
            </p>
            <Button variant="outline" className="w-full" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Usuário rejeitado
  if (status === "rejeitado") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sidebar via-primary to-sidebar">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="bg-card rounded-xl shadow-2xl p-8 space-y-4">
            <Shield className="h-14 w-14 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Acesso negado</h2>
            <p className="text-sm text-muted-foreground">
              Seu cadastro foi recusado. Entre em contato com o Comandante do Pelotão para mais informações.
            </p>
            <Button variant="outline" className="w-full" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const items = role === "comandante" ? [...navBase, ...navAdmin] : navBase;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border">
            <div className="flex items-center gap-2 px-2 py-3">
              <Shield className="h-6 w-6 text-sidebar-primary-foreground" />
              <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-bold text-sidebar-foreground leading-tight">SISMAT</span>
                <span className="text-[10px] text-sidebar-foreground/60 leading-tight">Pel Com</span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Operacional</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((it) => (
                    <SidebarMenuItem key={it.to}>
                      <SidebarMenuButton asChild isActive={pathname.startsWith(it.to)} tooltip={it.label}>
                        <Link to={it.to}>
                          <it.icon className="h-4 w-4" />
                          <span>{it.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border">
            <div className="px-2 py-2 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
              <div className="font-medium text-sidebar-foreground truncate">{fullName}</div>
              <div className="capitalize">{role}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <LogOut className="h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden">Sair</span>
            </Button>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card flex items-center px-4 gap-3 sticky top-0 z-10">
            <SidebarTrigger />
            <h1 className="text-sm font-semibold text-muted-foreground">Sistema de Gestão de Material Carga</h1>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, Radio, Clock } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

const signupSchema = loginSchema.extend({
  full_name: z.string().min(3, "Nome completo obrigatório"),
  posto_graduacao: z.string().min(1, "Informe o posto/graduação"),
  role: z.enum(["comandante", "telefonista"]),
});

function AuthPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cadastroPendente, setCadastroPendente] = useState(false);

  const loginForm = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const signupForm = useForm<z.infer<typeof signupSchema>>({ resolver: zodResolver(signupSchema), defaultValues: { email: "", password: "", full_name: "", posto_graduacao: "", role: "telefonista" } });

  async function onLogin(values: z.infer<typeof loginSchema>) {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(values);
    setLoading(false);
    if (error) return toast.error("Falha no login: " + error.message);
    toast.success("Bem-vindo!");
    nav({ to: "/dashboard" });
  }

  async function onSignup(values: z.infer<typeof signupSchema>) {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: values.full_name,
          posto_graduacao: values.posto_graduacao,
          role: values.role,
          // status inicia como 'pendente' — definido na migração SQL
        },
      },
    });
    setLoading(false);
    if (error) return toast.error("Falha no cadastro: " + error.message);
    setCadastroPendente(true);
  }

  if (cadastroPendente) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sidebar via-primary to-sidebar">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl text-center">
            <CardHeader>
              <div className="flex justify-center mb-2">
                <Clock className="h-12 w-12 text-yellow-500" />
              </div>
              <CardTitle>Cadastro realizado!</CardTitle>
              <CardDescription>Aguardando aprovação do Comandante</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Seu cadastro foi recebido. O Comandante do Pelotão precisará aprovar o seu acesso antes que você possa utilizar o sistema.
              </p>
              <p className="text-sm text-muted-foreground">
                Após a aprovação, faça login normalmente com seu e-mail e senha.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setCadastroPendente(false)}>
                Voltar para login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sidebar via-primary to-sidebar">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 text-primary-foreground">
          <div className="inline-flex items-center gap-3 mb-3">
            <Shield className="h-10 w-10" />
            <Radio className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">SISMAT</h1>
          <p className="text-sm opacity-90 mt-1">Gestão de Material Carga · Pel Com</p>
        </div>

        <Card className="shadow-2xl">
          <CardHeader>
            <CardTitle>Acesso ao Sistema</CardTitle>
            <CardDescription>Autentique-se para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="l-email">E-mail</Label>
                    <Input id="l-email" type="email" {...loginForm.register("email")} />
                    {loginForm.formState.errors.email && <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="l-pass">Senha</Label>
                    <Input id="l-pass" type="password" {...loginForm.register("password")} />
                    {loginForm.formState.errors.password && <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="s-name">Nome completo</Label>
                    <Input id="s-name" {...signupForm.register("full_name")} />
                    {signupForm.formState.errors.full_name && <p className="text-xs text-destructive">{signupForm.formState.errors.full_name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s-posto">Posto / Graduação</Label>
                    <Input id="s-posto" placeholder="Ex: Cap, 1º Ten, Sgt..." {...signupForm.register("posto_graduacao")} />
                    {signupForm.formState.errors.posto_graduacao && <p className="text-xs text-destructive">{signupForm.formState.errors.posto_graduacao.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s-role">Função solicitada</Label>
                    <select
                      id="s-role"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      {...signupForm.register("role")}
                    >
                      <option value="telefonista">Telefonista</option>
                      <option value="comandante">Cmt Pel</option>
                    </select>
                    {signupForm.formState.errors.role && <p className="text-xs text-destructive">{signupForm.formState.errors.role.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s-email">E-mail</Label>
                    <Input id="s-email" type="email" {...signupForm.register("email")} />
                    {signupForm.formState.errors.email && <p className="text-xs text-destructive">{signupForm.formState.errors.email.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s-pass">Senha</Label>
                    <Input id="s-pass" type="password" {...signupForm.register("password")} />
                    {signupForm.formState.errors.password && <p className="text-xs text-destructive">{signupForm.formState.errors.password.message}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? "Cadastrando..." : "Solicitar Cadastro"}</Button>
                  <p className="text-xs text-muted-foreground text-center">
                    O cadastro precisa ser aprovado pelo Comandante do Pelotão antes de liberar o acesso.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-primary-foreground/70 mt-6">
          Sistema de uso restrito · Exército Brasileiro
        </p>
      </div>
    </div>
  );
}

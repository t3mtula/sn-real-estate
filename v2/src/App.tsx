import { LogOut } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { isAllowedEmail, signInWithGoogle, signOut } from "@/lib/auth";
import { env } from "@/lib/env";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.12-1.43.34-2.1V7.07H2.18a10.99 10.99 0 0 0 0 9.86l3.66-2.83Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.83C6.71 7.3 9.14 5.38 12 5.38Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoginScreen() {
  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Sign-in error:", err);
      alert("เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 text-card-foreground shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">SN Real Estate</h1>
          <p className="text-muted-foreground text-sm">
            เข้าสู่ระบบด้วย Google account ของ{" "}
            <span className="font-medium">@{env.ALLOWED_EMAIL_DOMAIN}</span>
          </p>
        </div>
        <Button onClick={handleSignIn} className="w-full" size="lg" variant="outline">
          <GoogleIcon />
          เข้าสู่ระบบด้วย Google
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          v2 (in development) · ใช้ได้เฉพาะพนักงานของบริษัท
        </p>
      </div>
    </div>
  );
}

function DomainBlockedScreen({ email }: { email: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-destructive/40 bg-card p-8 text-center text-card-foreground shadow-sm">
        <h1 className="text-xl font-semibold">เข้าสู่ระบบไม่ได้</h1>
        <p className="text-muted-foreground text-sm">
          อีเมล <span className="font-medium">{email}</span> ไม่อยู่ใน domain ของบริษัท
          <br />
          ระบบรับเฉพาะอีเมล <span className="font-medium">@{env.ALLOWED_EMAIL_DOMAIN}</span>{" "}
          เท่านั้น
        </p>
        <Button variant="outline" onClick={signOut} className="w-full">
          <LogOut className="size-4" />
          ออกจากระบบ
        </Button>
      </div>
    </div>
  );
}

function HomePage({ email, name }: { email: string; name: string }) {
  return (
    <AppLayout
      activeKey="home"
      eyebrow="ภาพรวม"
      title="หน้าแรก"
      user={{ name, email }}
    >
      <div className="space-y-8">
        <section className="space-y-1">
          <p className="text-xl font-semibold tracking-tight">ยินดีต้อนรับ {name}</p>
          <p className="text-muted-foreground text-sm">
            Phase 0 (Scaffold + Auth + Layout) พร้อมแล้ว · Phase 1 (Contract feature) เริ่มต่อ
          </p>
        </section>

        <section>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            สถานะระบบ
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Build", value: "Vite 6 + React 19" },
              { label: "UI", value: "shadcn/ui · brand v5" },
              { label: "Backend", value: "Supabase" },
              { label: "Auth", value: `Google · @${env.ALLOWED_EMAIL_DOMAIN}` },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-md border bg-card p-3.5 text-card-foreground"
              >
                <p className="text-muted-foreground text-[11px] uppercase tracking-wide">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Brand v5 — Quiet & Confident
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs">
              <span className="size-3 rounded-sm bg-primary" />
              Primary teal #0F4C5C
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs">
              <span className="size-3 rounded-sm bg-accent" />
              Accent copper #C77D49
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs">
              <span className="size-3 rounded-sm bg-background ring-1 ring-border" />
              Surface #FAFAFA
            </span>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function App() {
  const auth = useAuth();

  if (auth.status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <p className="text-muted-foreground text-sm">กำลังโหลด...</p>
      </div>
    );
  }

  if (auth.status === "signed-out") {
    return <LoginScreen />;
  }

  const email = auth.user.email ?? "";
  if (!isAllowedEmail(email)) {
    return <DomainBlockedScreen email={email} />;
  }

  const name =
    (auth.user.user_metadata?.full_name as string | undefined) ?? email.split("@")[0];

  return <HomePage email={email} name={name} />;
}

export default App;

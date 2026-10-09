import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StaffNavbar from '@/components/staff/StaffNavbar';

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, active')
    .eq('id', user.id)
    .single();

  const userProfile = profile as { full_name: string; role: 'staff' | 'admin'; active: boolean } | null;

  if (!userProfile || !userProfile.active) {
    redirect('/login?error=account_deactivated');
  }

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col md:flex-row">
      <StaffNavbar
        user={{
          id: user.id,
          email: user.email,
          fullName: userProfile.full_name,
          role: userProfile.role,
        }}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

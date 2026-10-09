import CustomerWizard from '@/components/customer/CustomerWizard';

interface PageProps {
  params: {
    token: string;
  };
}

export default function CustomerBookingPage({ params }: PageProps) {
  return <CustomerWizard token={params.token} />;
}

import CompanyClientLayout from '@/components/layouts/CompanyClientLayout';

// generateStaticParams is used for static export (output: 'export').
// We provide a 'placeholder' ID to pre-render the company route structure.
// The .htaccess file handles rewriting real company IDs to this structure.
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return <CompanyClientLayout>{children}</CompanyClientLayout>;
}

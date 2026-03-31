export function generateStaticParams() {
  return [{ lcId: 'placeholder' }];
}

export default function LCLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
